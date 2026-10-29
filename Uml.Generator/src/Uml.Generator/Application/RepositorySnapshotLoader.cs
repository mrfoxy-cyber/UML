using Uml.Generator.Authentication;
using Uml.Generator.Configuration;
using Uml.Generator.Repository;

namespace Uml.Generator.Application;

internal static class RepositorySnapshotLoader
{
    public static async Task<(SnapshotResult Snapshot, string Authentication)> LoadAsync(
        string configPath, string workspace, CancellationToken cancellationToken)
    {
        var request = RepositoryConfigurationReader.Load(configPath, workspace);
        var credential = new GitHubCredentialProvider().Get(request.Repository);
        using var http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(45) };
        var reader = new GitHubReader(new GitHubRepositoryClient(http, credential.Token), new SnapshotStore(workspace));
        return (await reader.ReadAsync(request, cancellationToken), credential.Source);
    }
}
