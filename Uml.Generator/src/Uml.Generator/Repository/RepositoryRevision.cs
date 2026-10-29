namespace Uml.Generator.Repository;

public abstract record RepositoryRevision;

public sealed record BranchRevision(string Name) : RepositoryRevision;

public sealed record CommitRevision(string Sha) : RepositoryRevision;

public sealed record PullRequestRevision(int Number) : RepositoryRevision;
