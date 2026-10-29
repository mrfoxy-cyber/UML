using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Extraction.Class;

internal sealed record IndexedClass(AnalysedType Type, string Compilation, bool External = false);

internal sealed class ClassAnalysisIndex
{
    public Dictionary<string, IndexedClass> Types { get; } = new(StringComparer.Ordinal);
    public Dictionary<string, string> Owners { get; } = new(StringComparer.Ordinal);

    public ClassAnalysisIndex(AnalysedProject project)
    {
        foreach (var group in project.Compilations)
        foreach (var type in group.Types)
        {
            Types.Add(type.Id, new IndexedClass(type, group.Id));
            Owners.Add(type.Id, type.Id);
            foreach (var member in type.Members) Owners.Add(member.Id, type.Id);
            foreach (var method in type.Methods) Owners.Add(method.Id, type.Id);
        }
    }

    public static string? ViewerKind(string kind) => kind switch
    {
        "Class" or "Struct" => "class", "Interface" => "interface", "Enum" => "enum", _ => null
    };
}
