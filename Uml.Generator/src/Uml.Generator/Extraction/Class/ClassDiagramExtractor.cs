using Uml.Generator.Analysis.Models;
using Uml.Generator.Extraction.Models;

namespace Uml.Generator.Extraction.Class;

/// <summary>Selects a structural view from analysis facts; never reads source files.</summary>
public sealed class ClassDiagramExtractor
{
    public ExtractedClassDiagram Extract(AnalysedProject project, ClassDiagramDefinition definition, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var options = definition.Class ?? new ClassDiagramOptions();
        ClassOptionsValidator.Validate(project, definition, options);
        var index = new ClassAnalysisIndex(project);
        var scope = ClassSelector.Scope(index, options);
        var diagnostics = new List<ExtractionDiagnostic>();
        var relationships = new ClassRelationshipExtractor(index, options, scope, diagnostics).Extract(project, cancellationToken);
        var classes = ClassSelector.Select(index, options, scope, relationships, diagnostics, cancellationToken);
        var ids = classes.Select(type => type.SymbolId).ToHashSet(StringComparer.Ordinal);
        var retained = relationships.Where(edge => ids.Contains(edge.FromId) && ids.Contains(edge.ToId)).ToArray();
        foreach (var edge in relationships.Where(edge => ids.Contains(edge.FromId) && !ids.Contains(edge.ToId)))
            diagnostics.Add(new ExtractionDiagnostic("CLASS_CONTEXT_LIMIT", "Relationship omitted because its target exceeds the selected context depth.", edge.FromId, edge.Evidence[0].Source));
        foreach (var group in project.Compilations.Where(group => classes.Any(type => type.Compilation == group.Id)))
            if (group.Diagnostics.Any(diagnostic => diagnostic.Severity == "error"))
                diagnostics.Add(new ExtractionDiagnostic("CLASS_PARTIAL_ANALYSIS", "Compilation has analysis errors: " + group.Id));
        return new ExtractedClassDiagram(definition.Id, definition.Title, project.Snapshot, options, classes, retained,
            diagnostics.Where(diagnostic => diagnostic.Code == "CLASS_UNSUPPORTED_TYPE" || diagnostic.SymbolId == null || ids.Contains(diagnostic.SymbolId) ||
                index.Owners.TryGetValue(diagnostic.SymbolId, out var owner) && ids.Contains(owner))
                .OrderBy(diagnostic => diagnostic.Code, StringComparer.Ordinal).ThenBy(diagnostic => diagnostic.SymbolId, StringComparer.Ordinal)
                .ThenBy(diagnostic => diagnostic.Message, StringComparer.Ordinal).ToArray());
    }
}
