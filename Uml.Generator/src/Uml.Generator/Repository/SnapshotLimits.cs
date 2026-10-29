namespace Uml.Generator.Repository;

public sealed record SnapshotLimits
{
    public int MaxFiles { get; init; } = 500;
    public int MaxFileBytes { get; init; } = 2 * 1024 * 1024;
    public int MaxTotalBytes { get; init; } = 20 * 1024 * 1024;

    internal void Validate()
    {
        if (MaxFiles < 1 || MaxFileBytes < 1 || MaxTotalBytes < MaxFileBytes)
        {
            throw new ArgumentException("Snapshot limits must be positive, with total size at least the file size limit.");
        }
    }
}
