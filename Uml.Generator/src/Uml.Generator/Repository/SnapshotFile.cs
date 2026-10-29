namespace Uml.Generator.Repository;

public sealed record SnapshotFile(
    string Path,
    string BlobSha,
    string ContentSha256,
    long ByteLength,
    bool IsTest);
