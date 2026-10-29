using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Uml.Generator.Analysis.CSharp;
using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Analysis.Tests;

internal static class UmlAnnotationReader
{
    private static readonly HashSet<string> Types = new(StringComparer.Ordinal)
    {
        "class", "object", "component", "package", "deployment", "composite-structure", "profile", "aggregation",
        "usecase", "sequence", "communication", "activity", "state", "timing", "interaction-overview"
    };

    public static IReadOnlyList<UmlAnnotation> Read(SyntaxNode method, List<AnalysisDiagnostic> diagnostics)
    {
        var annotations = new List<UmlAnnotation>();
        foreach (var trivia in method.GetLeadingTrivia().Where(trivia => trivia.IsKind(SyntaxKind.SingleLineCommentTrivia) ||
                     trivia.IsKind(SyntaxKind.MultiLineCommentTrivia)))
        {
            var comment = trivia.ToString();
            var offset = 0;
            while ((offset = comment.IndexOf("[uml:", offset, StringComparison.Ordinal)) >= 0)
            {
                var end = comment.IndexOf(']', offset);
                var location = SymbolIdentity.Location(trivia.GetLocation());
                if (end < 0) { Invalid(diagnostics, location); break; }
                var content = comment[(offset + 5)..end].Trim();
                var split = content.IndexOfAny([' ', '\t', '\r', '\n']);
                var type = split < 0 ? content : content[..split];
                var rest = split < 0 ? "" : content[split..].Trim();
                string? id = null;
                string? title = null;
                var valid = Types.Contains(type);
                while (rest.Length > 0)
                {
                    var key = rest.StartsWith("id:", StringComparison.Ordinal) ? "id:" :
                        rest.StartsWith("title:", StringComparison.Ordinal) ? "title:" : null;
                    if (key == null) { valid = false; break; }
                    rest = rest[key.Length..].TrimStart();
                    var nextId = rest.IndexOf(" id:", StringComparison.Ordinal);
                    var nextTitle = rest.IndexOf(" title:", StringComparison.Ordinal);
                    var next = nextId < 0 ? nextTitle : nextTitle < 0 ? nextId : Math.Min(nextId, nextTitle);
                    var value = next < 0 ? rest.Trim() : rest[..next].Trim();
                    if (value.Length == 0 || (key == "id:" ? id != null : title != null)) valid = false;
                    if (key == "id:") id = value; else title = value;
                    rest = next < 0 ? "" : rest[next..].TrimStart();
                }
                if (valid) annotations.Add(new UmlAnnotation(type, id, title, location));
                else Invalid(diagnostics, location);
                offset = end + 1;
            }
        }
        return annotations;
    }

    private static void Invalid(List<AnalysisDiagnostic> diagnostics, SourceLocation location) => diagnostics.Add(
        new AnalysisDiagnostic("UML001", "warning", "Invalid UML annotation. Use [uml: sequence id: parking title: Parking].", location));
}
