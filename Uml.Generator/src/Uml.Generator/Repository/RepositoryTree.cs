namespace Uml.Generator.Repository;

public sealed record RepositoryTree(
    string Sha,
    bool Truncated,
    IReadOnlyList<RepositoryTreeEntry> Entries);

public sealed record RepositoryTreeEntry(
    string Path,
    string Sha,
    string Type,
    string Mode,
    long Size);

public sealed record SelectedRepositoryFile(RepositoryTreeEntry Entry, bool IsTest);
