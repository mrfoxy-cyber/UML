using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Uml.Generator.Repository;

public sealed class SnapshotStore(string generatorWorkspace)
{
    private readonly SnapshotCachePaths paths = new(generatorWorkspace);
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        NewLine = "\n"
    };

    /// <summary>Opens an existing pinned snapshot offline and verifies every blob before use.</summary>
    public async Task<SnapshotResult> OpenAsync(string key, CancellationToken cancellationToken = default)
    {
        var directory = paths.Snapshot(key);
        var path = Path.Combine(directory, "manifest.json");
        SnapshotCachePaths.EnsureNoLinks(path);
        if (new FileInfo(path).Length > 1024 * 1024) throw new InvalidDataException("Snapshot manifest exceeds its size limit.");
        var manifest = JsonSerializer.Deserialize<SnapshotManifest>(await File.ReadAllTextAsync(path, cancellationToken), Json)
            ?? throw new InvalidDataException("Snapshot manifest is empty.");
        var limits = new SnapshotLimits();
        if (manifest.Version != 1 || manifest.SelectionHash != key || manifest.Files == null ||
            manifest.Files.Count is < 1 || manifest.Files.Count > limits.MaxFiles ||
            manifest.Files.Any(file => file == null || string.IsNullOrWhiteSpace(file.Path) || file.ByteLength < 0 || file.ByteLength > limits.MaxFileBytes) ||
            manifest.Files.Sum(file => file.ByteLength) > limits.MaxTotalBytes ||
            manifest.Files.Select(file => file.Path).Distinct(StringComparer.Ordinal).Count() != manifest.Files.Count)
            throw new InvalidDataException("Snapshot manifest has invalid metadata or exceeds snapshot limits.");
        var revision = new PinnedRevision(GitHubRepository.Parse(manifest.Repository), GitHubRepository.Parse(manifest.ContentRepository),
            GitObjectHash.RequireSha(manifest.CommitSha), GitObjectHash.RequireSha(manifest.TreeSha));
        var selection = manifest.Files.Select(file => new SelectedRepositoryFile(
            new RepositoryTreeEntry(file.Path, GitObjectHash.RequireSha(file.BlobSha), "blob", "100644", file.ByteLength), file.IsTest)).ToArray();
        if (SelectionHash(revision, selection) != key) throw new InvalidDataException("Snapshot selection identity has changed.");
        return await ReadExistingAsync(directory, key, revision, selection, cancellationToken);
    }

    public async Task<SnapshotResult> GetOrCreateAsync(
        PinnedRevision revision,
        IReadOnlyList<SelectedRepositoryFile> selection,
        Func<string, CancellationToken, Task<byte[]>> download,
        CancellationToken cancellationToken = default)
    {
        var key = SelectionHash(revision, selection);
        var destination = paths.Snapshot(key);
        if (Directory.Exists(destination))
        {
            return await ReadExistingAsync(destination, key, revision, selection, cancellationToken);
        }

        var staging = paths.NewStagingDirectory();
        try
        {
            var files = new List<SnapshotFile>();
            var downloaded = new Dictionary<string, byte[]>(StringComparer.Ordinal);
            foreach (var item in selection)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var sha = GitObjectHash.RequireSha(item.Entry.Sha);
                if (!downloaded.TryGetValue(sha, out var content))
                {
                    content = await download(sha, cancellationToken);
                    VerifyBlob(item, content);
                    await File.WriteAllBytesAsync(Path.Combine(staging, sha + ".blob"), content, cancellationToken);
                    downloaded[sha] = content;
                }

                VerifyBlob(item, content);
                files.Add(new SnapshotFile(item.Entry.Path, sha, GitObjectHash.Content(content), content.Length, item.IsTest));
            }

            var manifest = new SnapshotManifest(1, revision.RequestedRepository.FullName,
                revision.ContentRepository.FullName, revision.CommitSha, revision.TreeSha, key, files);
            await File.WriteAllTextAsync(Path.Combine(staging, "manifest.json"),
                JsonSerializer.Serialize(manifest, Json) + "\n", cancellationToken);

            cancellationToken.ThrowIfCancellationRequested();
            SnapshotCachePaths.EnsureNoLinks(destination);
            foreach (var file in Directory.EnumerateFiles(staging)) File.SetAttributes(file, FileAttributes.ReadOnly);
            Directory.Move(staging, destination);
            return new SnapshotResult(destination, manifest, FromCache: false);
        }
        finally
        {
            if (Directory.Exists(staging)) paths.RemoveStagingDirectory(staging);
        }
    }

    public async Task<byte[]> ReadFileAsync(
        SnapshotResult snapshot,
        SnapshotFile file,
        CancellationToken cancellationToken = default)
    {
        var directory = paths.Snapshot(snapshot.Manifest.SelectionHash);
        if (directory != Path.GetFullPath(snapshot.Directory) || !snapshot.Manifest.Files.Contains(file))
        {
            throw new InvalidDataException("File does not belong to this snapshot.");
        }

        var path = Path.Combine(directory, GitObjectHash.RequireSha(file.BlobSha) + ".blob");
        SnapshotCachePaths.EnsureNoLinks(path);
        if (new FileInfo(path).Length != file.ByteLength)
        {
            throw new InvalidDataException("Cached snapshot file size has changed.");
        }

        var content = await File.ReadAllBytesAsync(path, cancellationToken);
        if (GitObjectHash.Content(content) != file.ContentSha256 || GitObjectHash.Blob(content) != file.BlobSha)
        {
            throw new InvalidDataException("Cached snapshot file failed its integrity check.");
        }

        return content;
    }

    private async Task<SnapshotResult> ReadExistingAsync(
        string directory,
        string key,
        PinnedRevision revision,
        IReadOnlyList<SelectedRepositoryFile> selection,
        CancellationToken cancellationToken)
    {
        var manifestPath = Path.Combine(directory, "manifest.json");
        SnapshotCachePaths.EnsureNoLinks(manifestPath);
        if (new FileInfo(manifestPath).Length > 1024 * 1024)
        {
            throw new InvalidDataException("Cached snapshot manifest exceeds its size limit.");
        }

        var text = await File.ReadAllTextAsync(manifestPath, cancellationToken);
        var manifest = JsonSerializer.Deserialize<SnapshotManifest>(text, Json)
            ?? throw new InvalidDataException("Cached snapshot manifest is empty.");
        if (manifest.Version != 1 || manifest.SelectionHash != key ||
            manifest.Repository != revision.RequestedRepository.FullName ||
            manifest.ContentRepository != revision.ContentRepository.FullName ||
            manifest.CommitSha != revision.CommitSha || manifest.TreeSha != revision.TreeSha || manifest.Files is null ||
            manifest.Files.Count != selection.Count)
        {
            throw new InvalidDataException("Cached snapshot metadata does not match the requested source.");
        }

        var result = new SnapshotResult(directory, manifest, FromCache: true);
        for (var i = 0; i < selection.Count; i++)
        {
            var expected = selection[i];
            var actual = manifest.Files[i];
            if (actual is null || actual.Path != expected.Entry.Path || actual.BlobSha != expected.Entry.Sha ||
                actual.IsTest != expected.IsTest || actual.ByteLength != expected.Entry.Size)
            {
                throw new InvalidDataException("Cached snapshot file list does not match the requested selection.");
            }

            await ReadFileAsync(result, actual, cancellationToken);
        }

        return result;
    }

    private static void VerifyBlob(SelectedRepositoryFile file, byte[] content)
    {
        if (content.LongLength != file.Entry.Size || GitObjectHash.Blob(content) != file.Entry.Sha)
        {
            throw new InvalidDataException("Downloaded content does not match the pinned tree: " + file.Entry.Path);
        }
    }

    private static string SelectionHash(PinnedRevision revision, IReadOnlyList<SelectedRepositoryFile> selection)
    {
        var identity = JsonSerializer.Serialize(new
        {
            Version = 1,
            Requested = revision.RequestedRepository.FullName,
            Content = revision.ContentRepository.FullName,
            revision.CommitSha,
            revision.TreeSha,
            Files = selection.Select(file => new { file.Entry.Path, file.Entry.Sha, file.IsTest })
        });
        return GitObjectHash.Content(Encoding.UTF8.GetBytes(identity));
    }
}
