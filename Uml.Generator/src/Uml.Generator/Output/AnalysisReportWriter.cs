using System.Text.Json;
using Uml.Generator.Analysis.Models;
using Uml.Generator.Repository;

namespace Uml.Generator.Output;

public static class AnalysisReportWriter
{
    public static async Task<string> WriteAsync(string workspace, AnalysedProject project, CancellationToken cancellationToken)
    {
        var key = project.Snapshot.SelectionHash;
        if (key.Length != 64 || key.Any(character => !char.IsAsciiHexDigit(character)))
            throw new InvalidDataException("Invalid analysis snapshot identity.");
        var directory = Path.Combine(Path.GetFullPath(workspace), "output", "analysis", key);
        SnapshotCachePaths.EnsureNoLinks(directory);
        Directory.CreateDirectory(directory);
        var destination = Path.Combine(directory, "analysis.json");
        SnapshotCachePaths.EnsureNoLinks(destination);
        var temporary = Path.Combine(directory, ".pending-" + Guid.NewGuid().ToString("N"));
        try
        {
            await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write))
                await JsonSerializer.SerializeAsync(stream, project,
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true, MaxDepth = 512 }, cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            File.Move(temporary, destination, overwrite: true);
            return destination;
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }
}
