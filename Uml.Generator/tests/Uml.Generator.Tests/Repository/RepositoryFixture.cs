using System.Security.Cryptography;
using System.Text;
using Uml.Generator.Repository;

namespace Uml.Generator.Tests.Repository;

internal sealed class RepositoryFixture
{
    public string Workspace { get; }
    public FakeGitHubClient Client { get; } = new();
    public SnapshotStore Store { get; }
    public GitHubReader Reader { get; }

    public RepositoryFixture(SnapshotLimits? limits = null)
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !File.Exists(Path.Combine(root.FullName, "Uml.Generator.sln"))) root = root.Parent;
        if (root == null) throw new DirectoryNotFoundException("Generator test workspace was not found.");
        Workspace = Path.Combine(root.FullName, ".cache", "repository-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Workspace);
        Store = new SnapshotStore(Workspace);
        Reader = new GitHubReader(Client, Store, limits);
    }

    public SnapshotRequest Request(
        string[]? include = null,
        string[]? tests = null,
        string[]? ignores = null)
    {
        return new SnapshotRequest(GitHubRepository.Parse("acme/garage"), new BranchRevision("main"),
            include ?? ["App/**/*.cs"], tests ?? [], ignores ?? []);
    }

    public string[] CacheDirectories()
    {
        var root = Path.Combine(Workspace, ".cache", "snapshots");
        return Directory.Exists(root) ? Directory.GetDirectories(root) : [];
    }
}

internal sealed class FakeGitHubClient : IGitHubRepositoryClient
{
    public PinnedRevision Revision { get; set; } = new(
        GitHubRepository.Parse("acme/garage"), GitHubRepository.Parse("acme/garage"),
        new string('a', 40), new string('b', 40));
    public List<RepositoryTreeEntry> Entries { get; } = [];
    public Dictionary<string, byte[]> Blobs { get; } = [];
    public List<string> Downloaded { get; } = [];
    public List<(string Repository, string Sha)> TreeRequests { get; } = [];
    public bool Truncated { get; set; }
    public string? FailingBlob { get; set; }
    public string? TreeShaOverride { get; set; }
    public bool CancelDownload { get; set; }

    public RepositoryTreeEntry Add(string path, string text, string mode = "100644")
    {
        var content = Encoding.UTF8.GetBytes(text);
        var header = Encoding.ASCII.GetBytes($"blob {content.Length}\0");
        var sha = Convert.ToHexStringLower(SHA1.HashData([.. header, .. content]));
        var entry = new RepositoryTreeEntry(path, sha, "blob", mode, content.Length);
        Entries.Add(entry);
        Blobs[sha] = content;
        return entry;
    }

    public Task<PinnedRevision> ResolveAsync(GitHubRepository repository, RepositoryRevision revision, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(Revision);
    }

    public Task<RepositoryTree> GetTreeAsync(GitHubRepository repository, string treeSha, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        TreeRequests.Add((repository.FullName, treeSha));
        return Task.FromResult(new RepositoryTree(TreeShaOverride ?? Revision.TreeSha, Truncated, Entries));
    }

    public Task<byte[]> GetBlobAsync(GitHubRepository repository, string blobSha, int maximumBytes, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Downloaded.Add(blobSha);
        if (CancelDownload) throw new OperationCanceledException();
        if (blobSha == FailingBlob) throw new HttpRequestException("Simulated download failure.");
        return Task.FromResult(Blobs[blobSha]);
    }
}
