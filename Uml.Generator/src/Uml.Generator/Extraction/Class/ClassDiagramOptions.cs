namespace Uml.Generator.Extraction.Class;

public sealed record ClassDiagramDefinition(string Id, string Type, string Title, ClassDiagramOptions? Class = null);

public sealed record ClassDiagramOptions
{
    public string[] Compilations { get; init; } = [];
    public string[] Include { get; init; } = ["**/*.cs"];
    public string[] Exclude { get; init; } = [];
    public ClassMemberOptions Members { get; init; } = new();
    public string[] Relationships { get; init; } = ["inheritance", "implementation", "member-type"];
    public ClassContextOptions Context { get; init; } = new();
    public string GroupBy { get; init; } = "namespace";
}

public sealed record ClassMemberOptions
{
    public string[] Visibility { get; init; } = ["public", "protected"];
    public bool Fields { get; init; }
    public bool Properties { get; init; } = true;
    public bool Constructors { get; init; } = true;
    public bool Methods { get; init; } = true;
    public bool Accessors { get; init; }
}

public sealed record ClassContextOptions(int Depth = 1, bool IncludeExternal = false);
