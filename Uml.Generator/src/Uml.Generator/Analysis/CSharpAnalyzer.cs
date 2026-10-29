using Microsoft.CodeAnalysis;
using Uml.Generator.Analysis.CSharp;
using Uml.Generator.Analysis.Input;
using Uml.Generator.Analysis.Models;
using Uml.Generator.Analysis.Tests;
using Uml.Generator.Repository;

namespace Uml.Generator.Analysis;

/// <summary>Reads verified snapshot data and returns code facts without executing repository code.</summary>
public sealed class CSharpAnalyzer(SnapshotStore store)
{
    public async Task<AnalysedProject> AnalyzeAsync(SnapshotResult snapshot, AnalysisOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        options ??= AnalysisOptions.Default;
        var sources = await new SnapshotSourceReader(store).ReadAsync(snapshot, cancellationToken);
        var compilations = new CompilationBuilder().Build(sources, options, cancellationToken);
        var identity = new SymbolIdentity(snapshot.Manifest.Repository, compilations.Keys);
        var testFiles = snapshot.Manifest.Files.Where(file => file.IsTest).Select(file => file.Path).ToHashSet(StringComparer.Ordinal);
        var results = new List<AnalysedCompilation>();
        foreach (var group in options.Compilations)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var compilation = compilations[group.Id];
            var diagnostics = compilation.GetDiagnostics(cancellationToken)
                .Where(diagnostic => diagnostic.Severity is DiagnosticSeverity.Error or DiagnosticSeverity.Warning)
                .Select(diagnostic => new AnalysisDiagnostic(diagnostic.Id, diagnostic.Severity.ToString().ToLowerInvariant(),
                    diagnostic.GetMessage(System.Globalization.CultureInfo.InvariantCulture),
                    diagnostic.Location.IsInSource ? SymbolIdentity.Location(diagnostic.Location) : null)).ToList();
            var types = new DeclarationReader(identity, cancellationToken).Read(compilation);
            foreach (var operation in types.SelectMany(type => type.Methods.Select(method => method.Body)
                         .Concat(type.Members.Select(member => member.Initializer))).Where(body => body != null)
                         .SelectMany(body => Walk(body!.Operations)))
            {
                if (operation.Kind == "DepthLimit")
                    diagnostics.Add(new AnalysisDiagnostic("UML002", "warning", "Method body nesting exceeds the supported depth; this subtree was omitted.", operation.Source));
                if (operation.Call is { Resolution: not "resolved" } call)
                    diagnostics.Add(new AnalysisDiagnostic("UML003", "warning", "Call target is " + call.Resolution + "; no target was guessed.", operation.Source));
            }
            var relationships = new RelationshipReader(identity, cancellationToken).Read(compilation, types);
            var tests = new TestDetector(identity, cancellationToken).Read(compilation, testFiles, diagnostics);
            results.Add(new AnalysedCompilation(group.Id, group,
                compilation.SyntaxTrees.Select(tree => tree.FilePath).Where(sources.ContainsKey).Order(StringComparer.Ordinal).ToArray(),
                types, relationships, tests, diagnostics.OrderBy(diagnostic => diagnostic.Source?.File, StringComparer.Ordinal)
                    .ThenBy(diagnostic => diagnostic.Source?.Start).ThenBy(diagnostic => diagnostic.Code, StringComparer.Ordinal).ToArray()));
        }
        return new AnalysedProject(1, 1, typeof(Microsoft.CodeAnalysis.CSharp.CSharpCompilation).Assembly.GetName().Version!.ToString(),
            System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription, snapshot.Manifest, results);
    }

    private static IEnumerable<BodyOperation> Walk(IEnumerable<BodyOperation> operations)
    {
        foreach (var operation in operations)
        {
            yield return operation;
            foreach (var child in Walk(operation.Children)) yield return child;
        }
    }
}
