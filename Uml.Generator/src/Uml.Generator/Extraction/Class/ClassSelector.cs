using Microsoft.Extensions.FileSystemGlobbing;
using Uml.Generator.Analysis.Models;
using Uml.Generator.Extraction.Models;

namespace Uml.Generator.Extraction.Class;

internal static class ClassSelector
{
    public static HashSet<string> Scope(ClassAnalysisIndex index, ClassDiagramOptions options) => index.Types.Values
        .Where(entry => options.Compilations.Length == 0 || options.Compilations.Contains(entry.Compilation))
        .Where(entry => !entry.Type.Sources.Any(source => Matches(options.Exclude, source.File)))
        .Select(entry => entry.Type.Id).ToHashSet(StringComparer.Ordinal);

    public static IReadOnlyList<ExtractedClass> Select(ClassAnalysisIndex index, ClassDiagramOptions options, ISet<string> scope,
        IReadOnlyList<ExtractedRelationship> relationships, List<ExtractionDiagnostic> diagnostics, CancellationToken cancellationToken)
    {
        var focus = scope.Where(id => index.Types[id].Type.Sources.Any(source => Matches(options.Include, source.File))).ToHashSet(StringComparer.Ordinal);
        foreach (var id in focus.Where(id => ClassAnalysisIndex.ViewerKind(index.Types[id].Type.Kind) == null).ToArray())
        {
            diagnostics.Add(new ExtractionDiagnostic("CLASS_UNSUPPORTED_TYPE", "Selected type kind is not supported: " + index.Types[id].Type.Kind, id));
            focus.Remove(id);
        }
        if (focus.Count == 0) throw new InvalidDataException("Class diagram selects no supported types. Check compilations and include/exclude patterns.");
        var selected = new HashSet<string>(focus, StringComparer.Ordinal);
        var frontier = new HashSet<string>(focus, StringComparer.Ordinal);
        for (var depth = 0; depth < options.Context.Depth; depth++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var next = relationships.Where(edge => frontier.Contains(edge.FromId)).Select(edge => edge.ToId)
                .Where(id => selected.Add(id)).ToHashSet(StringComparer.Ordinal);
            frontier = next;
        }
        return selected.Order(StringComparer.Ordinal).Select(id =>
        {
            var entry = index.Types[id];
            var type = entry.Type;
            var context = !focus.Contains(id);
            var notes = new List<string>();
            if (entry.External) notes.Add("External metadata type; source is outside this snapshot.");
            if (type.Kind == "Struct") notes.Add("C# struct, displayed using a class card.");
            if (type.Modifiers.Contains("record")) notes.Add("C# record.");
            if (type.Modifiers.Contains("abstract")) notes.Add("Abstract type.");
            if (type.Modifiers.Contains("static")) notes.Add("Static type.");
            return new ExtractedClass(id, type.DisplayName, ClassAnalysisIndex.ViewerKind(type.Kind)!, type.Namespace, entry.Compilation,
                context, entry.External, notes.Count == 0 ? null : string.Join(" ", notes),
                context ? [] : ClassMemberSelector.Select(type, options.Members), type.Sources, type.Modifiers.Contains("abstract") && type.Kind != "Interface");
        }).ToArray();
    }

    private static bool Matches(IReadOnlyList<string> patterns, string path)
    {
        if (patterns.Count == 0) return false;
        var matcher = new Matcher(StringComparison.Ordinal);
        matcher.AddIncludePatterns(patterns);
        return matcher.Match(path).HasMatches;
    }
}
