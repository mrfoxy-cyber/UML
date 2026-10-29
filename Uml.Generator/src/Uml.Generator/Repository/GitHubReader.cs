namespace Uml.Generator.Repository;

/// <summary>Coordinates revision pinning, file selection and verified snapshot storage.</summary>
public sealed class GitHubReader(
    IGitHubRepositoryClient client,
    SnapshotStore store,
    SnapshotLimits? limits = null)
{
    public async Task<SnapshotResult> ReadAsync(
        SnapshotRequest request,
        CancellationToken cancellationToken = default)
    {
        var bounds = limits ?? new SnapshotLimits();
        bounds.Validate();
        var selection = new FileSelection(request);
        var pinned = await client.ResolveAsync(request.Repository, request.Revision, cancellationToken);
        GitObjectHash.RequireSha(pinned.CommitSha);
        GitObjectHash.RequireSha(pinned.TreeSha);

        var tree = await client.GetTreeAsync(pinned.ContentRepository, pinned.TreeSha, cancellationToken);
        if (tree.Sha != pinned.TreeSha)
        {
            throw new InvalidDataException("The returned file tree does not belong to the pinned revision.");
        }

        var files = selection.Select(tree, bounds);
        return await store.GetOrCreateAsync(pinned, files,
            (sha, cancellation) => client.GetBlobAsync(
                pinned.ContentRepository, sha, bounds.MaxFileBytes, cancellation),
            cancellationToken);
    }
}
