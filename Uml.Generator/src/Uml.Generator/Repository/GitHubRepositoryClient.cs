using System.Text.Json;

namespace Uml.Generator.Repository;

/// <summary>Reads GitHub metadata and blobs through GET requests only.</summary>
public sealed class GitHubRepositoryClient(HttpClient httpClient, string token)
    : IGitHubRepositoryClient
{
    private readonly GitHubApi api = new(httpClient, token);

    public async Task<PinnedRevision> ResolveAsync(
        GitHubRepository repository,
        RepositoryRevision revision,
        CancellationToken cancellationToken = default)
    {
        repository = GitHubRepository.Parse(repository.FullName);
        var contentRepository = repository;
        string reference;

        switch (revision)
        {
            case BranchRevision branch when !string.IsNullOrWhiteSpace(branch.Name) && branch.Name.Length <= 250:
                reference = branch.Name;
                break;
            case CommitRevision commit:
                reference = GitObjectHash.RequireSha(commit.Sha);
                break;
            case PullRequestRevision pullRequest when pullRequest.Number > 0:
                using (var document = await api.GetJsonAsync(
                    $"{RepositoryPath(repository)}/pulls/{pullRequest.Number}", 1024 * 1024, cancellationToken))
                {
                    var head = document.RootElement.GetProperty("head");
                    reference = GitObjectHash.RequireSha(GitHubApi.RequiredString(head, "sha"));
                    if (!head.TryGetProperty("repo", out var headRepository) ||
                        headRepository.ValueKind != JsonValueKind.Object)
                    {
                        throw new InvalidDataException("The pull request's source repository is unavailable.");
                    }

                    contentRepository = GitHubRepository.Parse(
                        GitHubApi.RequiredString(headRepository, "full_name"));
                }
                break;
            default:
                throw new ArgumentException("Select a branch, full commit SHA, or positive pull request number.");
        }

        using var commitDocument = await api.GetJsonAsync(
            $"{RepositoryPath(contentRepository)}/commits/{Uri.EscapeDataString(reference)}",
            1024 * 1024, cancellationToken);
        var root = commitDocument.RootElement;
        var sha = GitObjectHash.RequireSha(GitHubApi.RequiredString(root, "sha"));
        var treeSha = GitObjectHash.RequireSha(
            GitHubApi.RequiredString(root.GetProperty("commit").GetProperty("tree"), "sha"));

        if (revision is not BranchRevision && sha != reference)
        {
            throw new InvalidDataException("GitHub returned a different commit than requested.");
        }

        return new PinnedRevision(repository, contentRepository, sha, treeSha);
    }

    public async Task<RepositoryTree> GetTreeAsync(
        GitHubRepository repository,
        string treeSha,
        CancellationToken cancellationToken = default)
    {
        treeSha = GitObjectHash.RequireSha(treeSha);
        using var document = await api.GetJsonAsync(
            $"{RepositoryPath(repository)}/git/trees/{treeSha}?recursive=1",
            10 * 1024 * 1024, cancellationToken);
        var root = document.RootElement;
        if (GitObjectHash.RequireSha(GitHubApi.RequiredString(root, "sha")) != treeSha)
        {
            throw new InvalidDataException("GitHub returned a different tree than requested.");
        }

        var entries = new List<RepositoryTreeEntry>();
        foreach (var entry in root.GetProperty("tree").EnumerateArray())
        {
            if (entries.Count >= 100000)
            {
                throw new InvalidDataException("Repository tree exceeds the supported entry limit.");
            }

            entries.Add(new RepositoryTreeEntry(
                GitHubApi.RequiredString(entry, "path"),
                GitObjectHash.RequireSha(GitHubApi.RequiredString(entry, "sha")),
                GitHubApi.RequiredString(entry, "type"),
                GitHubApi.RequiredString(entry, "mode"),
                entry.TryGetProperty("size", out var size) ? size.GetInt64() : 0));
        }

        return new RepositoryTree(treeSha, root.GetProperty("truncated").GetBoolean(), entries);
    }

    public async Task<byte[]> GetBlobAsync(
        GitHubRepository repository,
        string blobSha,
        int maximumBytes,
        CancellationToken cancellationToken = default)
    {
        blobSha = GitObjectHash.RequireSha(blobSha);
        using var document = await api.GetJsonAsync(
            $"{RepositoryPath(repository)}/git/blobs/{blobSha}",
            checked(maximumBytes * 2 + 4096), cancellationToken);
        var root = document.RootElement;
        if (GitObjectHash.RequireSha(GitHubApi.RequiredString(root, "sha")) != blobSha ||
            GitHubApi.RequiredString(root, "encoding") != "base64")
        {
            throw new InvalidDataException("Unexpected GitHub blob identity or encoding.");
        }

        var declaredSize = root.GetProperty("size").GetInt64();
        if (declaredSize < 0 || declaredSize > maximumBytes)
        {
            throw new InvalidDataException("GitHub blob exceeds the file size limit.");
        }

        var content = Convert.FromBase64String(root.GetProperty("content").GetString() ?? "");
        if (content.Length != declaredSize || GitObjectHash.Blob(content) != blobSha)
        {
            throw new InvalidDataException("GitHub blob content failed its integrity check.");
        }

        return content;
    }

    private static string RepositoryPath(GitHubRepository repository)
    {
        var validated = GitHubRepository.Parse(repository.FullName);
        return $"repos/{Uri.EscapeDataString(validated.Owner)}/{Uri.EscapeDataString(validated.Name)}";
    }
}
