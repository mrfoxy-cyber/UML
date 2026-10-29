namespace Uml.Generator.Repository;

public sealed record SnapshotResult(
    string Directory,
    SnapshotManifest Manifest,
    bool FromCache);
