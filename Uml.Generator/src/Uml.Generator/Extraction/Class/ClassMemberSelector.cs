using Uml.Generator.Analysis.Models;
using Uml.Generator.Extraction.Models;

namespace Uml.Generator.Extraction.Class;

internal static class ClassMemberSelector
{
    public static IReadOnlyList<ExtractedMember> Select(AnalysedType type, ClassMemberOptions options)
    {
        var members = new List<ExtractedMember>();
        foreach (var member in type.Members)
        {
            if (!Visible(member.Modifiers, options.Visibility)) continue;
            var enabled = member.Kind switch
            {
                "Field" => options.Fields || type.Kind == "Enum",
                "Property" or "Event" => options.Properties,
                _ => false
            };
            if (enabled) members.Add(new ExtractedMember(member.Id, "attribute",
                ClassMemberFormatter.Attribute(member, type.Kind == "Enum"), null, member.Sources));
        }
        foreach (var method in type.Methods)
        {
            if (!Visible(method.Modifiers, options.Visibility)) continue;
            var enabled = method.Kind switch
            {
                "Constructor" or "StaticConstructor" => options.Constructors,
                "PropertyGet" or "PropertySet" or "EventAdd" or "EventRemove" or "EventRaise" => options.Accessors,
                _ => options.Methods
            };
            if (enabled) members.Add(new ExtractedMember(method.Id, "operation",
                ClassMemberFormatter.Operation(type, method), method.CodeHash, method.Sources));
        }
        return members.OrderBy(member => member.Kind, StringComparer.Ordinal).ThenBy(member => member.Name, StringComparer.Ordinal)
            .ThenBy(member => member.SymbolId, StringComparer.Ordinal).ToArray();
    }

    private static bool Visible(IReadOnlyList<string> modifiers, IReadOnlyList<string> selected)
    {
        if (modifiers.Count == 0) return false;
        return modifiers[0] switch
        {
            "ProtectedOrInternal" or "ProtectedAndInternal" => selected.Contains("protected") || selected.Contains("internal"),
            _ => selected.Contains(modifiers[0].ToLowerInvariant())
        };
    }
}
