using System.Text.Json;
using Uml.Generator.Analysis;
using Uml.Generator.Configuration;
using Uml.Generator.Output;
using Uml.Generator.Repository;

namespace Uml.Generator.Application;

public sealed class AnalyzeCommand
{
    public async Task RunAsync(string configPath, string? snapshotKey, CancellationToken cancellationToken)
    {
        var workspace = WorkspaceDirectory.Find();
        var request = RepositoryConfigurationReader.Load(configPath, workspace);
        var options = AnalysisConfigurationReader.Load(configPath, workspace);
        var store = new SnapshotStore(workspace);
        var snapshot = snapshotKey == null
            ? (await RepositorySnapshotLoader.LoadAsync(configPath, workspace, cancellationToken)).Snapshot
            : await store.OpenAsync(snapshotKey, cancellationToken);
        if (!snapshot.Manifest.Repository.Equals(request.Repository.FullName, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Snapshot repository does not match the selected configuration.");
        if (snapshotKey != null && request.Revision is CommitRevision commit && commit.Sha != snapshot.Manifest.CommitSha)
            throw new InvalidDataException("Snapshot commit does not match the configured commit.");
        var result = await new CSharpAnalyzer(store).AnalyzeAsync(snapshot, options, cancellationToken);
        var path = await AnalysisReportWriter.WriteAsync(workspace, result, cancellationToken);
        Console.WriteLine(JsonSerializer.Serialize(new
        {
            snapshot.Manifest.Repository, snapshot.Manifest.CommitSha,
            Files = snapshot.Manifest.Files.Count,
            Compilations = result.Compilations.Count,
            Types = result.Compilations.Sum(group => group.Types.Count),
            Methods = result.Compilations.Sum(group => group.Types.Sum(type => type.Methods.Count)),
            Tests = result.Compilations.Sum(group => group.Tests.Count),
            Diagnostics = result.Compilations.Sum(group => group.Diagnostics.Count),
            IncompleteCompilations = result.Compilations.Where(group => group.Diagnostics.Any(diagnostic => diagnostic.Severity == "error"))
                .Select(group => group.Id).ToArray(),
            Offline = snapshotKey != null,
            Report = path
        }, new JsonSerializerOptions { WriteIndented = true }));
    }
}
