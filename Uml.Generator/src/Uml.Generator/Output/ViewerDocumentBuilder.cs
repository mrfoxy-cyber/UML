using Uml.Generator.Extraction.Models;
using Uml.Generator.Output.Models;

namespace Uml.Generator.Output;

public sealed record BuiltViewerDocument(ViewerDocument Document, ViewerIdMapper Ids);

public sealed class ViewerDocumentBuilder
{
    public BuiltViewerDocument Build(ExtractedClassDiagram diagram)
    {
        var ids = new ViewerIdMapper();
        var elements = new SortedDictionary<string, ViewerElement>(StringComparer.Ordinal);
        foreach (var type in diagram.Classes)
        {
            var members = type.Members.Select(member => new ViewerMember(ids.Map("member", member.SymbolId), member.Kind, member.Name)).ToArray();
            var displayName = type.IsAbstract ? type.Name + " (abstract)" : type.Name;
            elements.Add(ids.Map("type", type.SymbolId), new ViewerElement(type.Kind, type.Name, members, type.Notes,
                new ViewerDisplay("collapsed", new ViewerState(displayName, ["name", "kind", "count"]),
                    new ViewerState(displayName, ["name", "kind", "members", "notes"]))));
        }
        var groups = new List<ViewerGroup>();
        if (diagram.Options.GroupBy != "none")
        {
            var grouping = diagram.Classes.GroupBy(type => diagram.Options.GroupBy == "namespace" ?
                (string.IsNullOrEmpty(type.Namespace) ? "Global namespace" : type.Namespace) : type.Compilation);
            foreach (var group in grouping.OrderBy(group => group.Key, StringComparer.Ordinal))
            {
                var name = group.Key;
                groups.Add(new ViewerGroup(ids.Map("group", diagram.Options.GroupBy + "|" + name), name,
                    group.Select(type => ids.Map("type", type.SymbolId)).Order(StringComparer.Ordinal).ToArray(),
                    new ViewerDisplay("expanded", new ViewerState(name, ["name", "count"]), new ViewerState(name, ["name", "members"]))));
            }
        }
        var relationships = diagram.Relationships.Select(edge => new ViewerRelationship(ids.Map("relation", edge.Identity), edge.Kind,
            ids.Map("type", edge.FromId), ids.Map("type", edge.ToId))).ToArray();
        var view = new ViewerClassView(diagram.Id, "class", diagram.Title, elements.Keys.ToArray(),
            diagram.Classes.Where(type => type.IsContext).Select(type => ids.Map("type", type.SymbolId)).Order(StringComparer.Ordinal).ToArray());
        var document = new ViewerDocument(1, diagram.Id, diagram.Title, elements, groups, relationships, [view]);
        ViewerClassValidator.Validate(document);
        return new BuiltViewerDocument(document, ids);
    }
}
