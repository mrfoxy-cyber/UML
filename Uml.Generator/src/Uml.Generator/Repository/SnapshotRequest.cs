namespace Uml.Generator.Repository;

public sealed record SnapshotRequest(
    GitHubRepository Repository,
    RepositoryRevision Revision,
    IReadOnlyList<string> Include,
    IReadOnlyList<string> TestIncludes,
    IReadOnlyList<string> IgnoreRules);
