using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Uml.Generator.Analysis.CSharp;
using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Analysis.Tests;

internal sealed class TestDetector(SymbolIdentity identity, CancellationToken cancellationToken)
{
    private static readonly Dictionary<string, (string Namespace, string Framework)> Known = new(StringComparer.Ordinal)
    {
        ["Fact"] = ("Xunit", "xunit"), ["Theory"] = ("Xunit", "xunit"),
        ["Test"] = ("NUnit.Framework", "nunit"), ["TestCase"] = ("NUnit.Framework", "nunit"),
        ["TestCaseSource"] = ("NUnit.Framework", "nunit"),
        ["TestMethod"] = ("Microsoft.VisualStudio.TestTools.UnitTesting", "mstest"),
        ["DataTestMethod"] = ("Microsoft.VisualStudio.TestTools.UnitTesting", "mstest")
    };

    public IReadOnlyList<AnalysedTest> Read(CSharpCompilation compilation, ISet<string> testFiles, List<AnalysisDiagnostic> diagnostics)
    {
        var tests = new List<AnalysedTest>();
        foreach (var tree in compilation.SyntaxTrees.Where(tree => testFiles.Contains(tree.FilePath)))
        {
            var model = compilation.GetSemanticModel(tree);
            foreach (var method in tree.GetRoot(cancellationToken).DescendantNodes().OfType<MethodDeclarationSyntax>())
            {
                string? framework = null;
                var detection = "semantic";
                var attributes = method.AttributeLists.SelectMany(list => list.Attributes).ToArray();
                foreach (var attribute in attributes)
                {
                    var symbol = model.GetSymbolInfo(attribute, cancellationToken).Symbol as IMethodSymbol;
                    var name = symbol?.ContainingType.Name ?? attribute.Name.ToString().Split('.').Last();
                    if (name.EndsWith("Attribute", StringComparison.Ordinal)) name = name[..^9];
                    if (!Known.TryGetValue(name, out var known)) continue;
                    if (symbol != null && symbol.ContainingNamespace.ToDisplayString() != known.Namespace) continue;
                    framework = known.Framework;
                    if (symbol == null) detection = "syntax-unresolved";
                }
                if (framework == null || model.GetDeclaredSymbol(method, cancellationToken) is not IMethodSymbol declared) continue;
                var annotations = UmlAnnotationReader.Read(method, diagnostics);
                var id = identity.Id(declared);
                tests.Add(new AnalysedTest("test|" + id, id, declared.Name, framework, detection,
                    attributes.Select(attribute => attribute.ToString()).ToArray(), annotations));
            }
        }
        return tests.OrderBy(test => test.Id, StringComparer.Ordinal).ToArray();
    }
}
