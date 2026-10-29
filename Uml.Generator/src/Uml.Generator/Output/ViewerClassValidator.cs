using Uml.Generator.Extraction.Class;
using Uml.Generator.Output.Models;

namespace Uml.Generator.Output;

/// <summary>Guards the generated class-only subset. Integration checks also run the viewer's own contract.</summary>
internal static class ViewerClassValidator
{
    public static void Validate(ViewerDocument document)
    {
        ClassOptionsValidator.RequireId(document.Id);
        Text(document.Title, 240);
        Limit(document.Elements.Count, 150, "elements");
        if (document.Elements.Count == 0) throw new InvalidDataException("Viewer document must contain at least one class.");
        Limit(document.Elements.Sum(element => element.Value.Members.Count), 600, "identified members");
        Limit(document.Relationships.Count, 600, "relationships");
        Limit(document.Groups.Count, 50, "groups");
        var shared = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (id, element) in document.Elements)
        {
            Unique(shared, id);
            if (element.Kind is not ("class" or "interface" or "enum")) throw new InvalidDataException("Unsupported structural element kind.");
            Text(element.Name, 240);
            Text(element.Display.Collapsed.Name, 240);
            Text(element.Display.Expanded.Name, 240);
            if (element.Notes != null) Text(element.Notes, 6000);
            Limit(element.Members.Count, 200, "members on one element");
            foreach (var member in element.Members)
            {
                Unique(shared, member.Id);
                Text(member.Name, 1600);
                if (member.Kind is not ("operation" or "attribute")) throw new InvalidDataException("Unsupported member kind.");
            }
        }
        var edgeIds = new HashSet<string>(StringComparer.Ordinal);
        var parents = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var edge in document.Relationships)
        {
            Unique(edgeIds, edge.Id);
            if (!document.Elements.TryGetValue(edge.From, out var from) || !document.Elements.TryGetValue(edge.To, out var to))
                throw new InvalidDataException("Relationship has an absent endpoint.");
            if (edge.Kind == "inheritance")
            {
                if (from.Kind != to.Kind || from.Kind is not ("class" or "interface")) throw new InvalidDataException("Invalid inheritance endpoints.");
                if (!parents.TryGetValue(edge.From, out var values)) parents[edge.From] = values = [];
                values.Add(edge.To);
            }
            else if (edge.Kind == "implementation")
            {
                if (from.Kind != "class" || to.Kind != "interface") throw new InvalidDataException("Implementation must point from a class to an interface.");
            }
            else if (edge.Kind is not ("association" or "dependency")) throw new InvalidDataException("Unsupported generated relationship kind.");
        }
        var visited = new HashSet<string>(StringComparer.Ordinal);
        var pending = new HashSet<string>(StringComparer.Ordinal);
        void Visit(string id)
        {
            if (!pending.Add(id)) throw new InvalidDataException("Inheritance contains a cycle.");
            if (visited.Add(id) && parents.TryGetValue(id, out var values)) foreach (var parent in values) Visit(parent);
            pending.Remove(id);
        }
        foreach (var id in parents.Keys) Visit(id);
        var grouped = new HashSet<string>(StringComparer.Ordinal);
        var groupIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var group in document.Groups)
        {
            Unique(groupIds, group.Id);
            Text(group.Name, 240);
            if (group.Members.Count == 0) throw new InvalidDataException("Empty structural group.");
            foreach (var id in group.Members)
                if (!document.Elements.ContainsKey(id) || !grouped.Add(id)) throw new InvalidDataException("Groups must have unique, present members.");
        }
        foreach (var view in document.Views)
        {
            ClassOptionsValidator.RequireId(view.Id);
            Text(view.Title, 240);
            if (view.Type != "class" || view.Elements.Any(id => !document.Elements.ContainsKey(id)) ||
                view.ContextElements.Any(id => !view.Elements.Contains(id))) throw new InvalidDataException("Invalid class view selection.");
        }
    }

    private static void Unique(ISet<string> ids, string id)
    {
        ClassOptionsValidator.RequireId(id);
        if (!ids.Add(id)) throw new InvalidDataException("Duplicate viewer identity: " + id);
    }

    private static void Text(string value, int maximum)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > maximum)
            throw new InvalidDataException("Generated viewer text exceeds its limit or is empty. Narrow the selected detail.");
    }

    private static void Limit(int count, int maximum, string name)
    {
        if (count > maximum) throw new InvalidDataException($"Diagram contains {count} {name}; viewer maximum is {maximum}. Narrow the class selection or member detail. No content was truncated.");
    }
}
