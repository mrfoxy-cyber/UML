namespace Uml.Generator.Repository;

/// <summary>Identifies the immutable source and verified files of one analysis snapshot.</summary>
public sealed record SnapshotManifest(
    int Version,
    string Repository,
    string ContentRepository,
    string CommitSha,
    string TreeSha,
    string SelectionHash,
    IReadOnlyList<SnapshotFile> Files);
