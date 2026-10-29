using System.Text.Json;
using Uml.Generator.Analysis;
using Uml.Generator.Configuration;
using Uml.Generator.Extraction.Class;
using Uml.Generator.Output;
using Uml.Generator.Repository;

namespace Uml.Generator.Application;

public sealed class ClassDiagramCommand
{
    public async Task RunAsync(string configPath, string? snapshotKey, CancellationToken cancellationToken)
    {
        var workspace = WorkspaceDirectory.Find();
        var request = RepositoryConfigurationReader.Load(configPath, workspace);
        var options = AnalysisConfigurationReader.Load(configPath, workspace);
        var definitions = ClassConfigurationReader.Load(configPath, workspace);
        var store = new SnapshotStore(workspace);
        var snapshot = snapshotKey == null ? (await RepositorySnapshotLoader.LoadAsync(configPath, workspace, cancellationToken)).Snapshot :
            await store.OpenAsync(snapshotKey, cancellationToken);
        if (!snapshot.Manifest.Repository.Equals(request.Repository.FullName, StringComparison.OrdinalIgnoreCase) ||
            request.Revision is CommitRevision commit && commit.Sha != snapshot.Manifest.CommitSha)
            throw new InvalidDataException("Snapshot does not match the configured repository/commit.");
        var analysis = await new CSharpAnalyzer(store).AnalyzeAsync(snapshot, options, cancellationToken);
        var diagrams = definitions.Select(definition => new ClassDiagramExtractor().Extract(analysis, definition, cancellationToken)).ToArray();
        // Validate every diagram before publishing any export from this run.
        foreach (var diagram in diagrams) new ViewerDocumentBuilder().Build(diagram);
        foreach (var diagram in diagrams)
        {
            var export = await new ViewerJsonWriter().WriteAsync(workspace, diagram, cancellationToken);
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                diagram.Id, diagram.Title, snapshot.Manifest.CommitSha,
                Classes = diagram.Classes.Count, ContextClasses = diagram.Classes.Count(type => type.IsContext),
                Members = diagram.Classes.Sum(type => type.Members.Count), Relationships = diagram.Relationships.Count,
                Diagnostics = diagram.Diagnostics.Count, Offline = snapshotKey != null,
                export.Diagram, export.Provenance, export.Details
            }, new JsonSerializerOptions { WriteIndented = true }));
        }
    }
}
