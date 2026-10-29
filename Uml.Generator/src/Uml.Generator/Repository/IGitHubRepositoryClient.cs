namespace Uml.Generator.Repository;

public interface IGitHubRepositoryClient
{
    Task<PinnedRevision> ResolveAsync(
        GitHubRepository repository,
        RepositoryRevision revision,
        CancellationToken cancellationToken = default);

    Task<RepositoryTree> GetTreeAsync(
        GitHubRepository repository,
        string treeSha,
        CancellationToken cancellationToken = default);

    Task<byte[]> GetBlobAsync(
        GitHubRepository repository,
        string blobSha,
        int maximumBytes,
        CancellationToken cancellationToken = default);
}
