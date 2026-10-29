using System.Text.Json;

namespace Uml.Generator.Application;

public sealed class SnapshotCommand
{
    public async Task RunAsync(string configPath, CancellationToken cancellationToken)
    {
        var workspace = WorkspaceDirectory.Find();
        var (snapshot, authentication) = await RepositorySnapshotLoader.LoadAsync(configPath, workspace, cancellationToken);

        Console.WriteLine(JsonSerializer.Serialize(new
        {
            Authentication = authentication,
            snapshot.Manifest.Repository,
            snapshot.Manifest.ContentRepository,
            snapshot.Manifest.CommitSha,
            Files = snapshot.Manifest.Files.Count,
            snapshot.Directory,
            snapshot.FromCache
        }, new JsonSerializerOptions { WriteIndented = true }));
    }
}
