namespace Uml.Generator.Repository;

public sealed record PinnedRevision(
    GitHubRepository RequestedRepository,
    GitHubRepository ContentRepository,
    string CommitSha,
    string TreeSha);
