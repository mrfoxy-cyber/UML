namespace Uml.Generator.Output.Models;

public sealed record ViewerDocument(int Version, string Id, string Title,
    SortedDictionary<string, ViewerElement> Elements, IReadOnlyList<ViewerGroup> Groups,
    IReadOnlyList<ViewerRelationship> Relationships, IReadOnlyList<ViewerClassView> Views);

public sealed record ViewerElement(string Kind, string Name, IReadOnlyList<ViewerMember> Members, string? Notes, ViewerDisplay Display);
public sealed record ViewerMember(string Id, string Kind, string Name);
public sealed record ViewerGroup(string Id, string Name, IReadOnlyList<string> Members, ViewerDisplay Display);
public sealed record ViewerRelationship(string Id, string Kind, string From, string To);
public sealed record ViewerClassView(string Id, string Type, string Title, IReadOnlyList<string> Elements, IReadOnlyList<string> ContextElements);
public sealed record ViewerDisplay(string Initial, ViewerState Collapsed, ViewerState Expanded);
public sealed record ViewerState(string Name, IReadOnlyList<string> Show);
