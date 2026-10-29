using Microsoft.CodeAnalysis.Text;
using Uml.Generator.Repository;

namespace Uml.Generator.Analysis.Input;

public sealed class SnapshotSourceReader(SnapshotStore store)
{
    public async Task<IReadOnlyDictionary<string, SourceText>> ReadAsync(SnapshotResult snapshot, CancellationToken cancellationToken)
    {
        var sources = new SortedDictionary<string, SourceText>(StringComparer.Ordinal);
        foreach (var file in snapshot.Manifest.Files.Where(file => file.Path.EndsWith(".cs", StringComparison.Ordinal)))
        {
            var content = await store.ReadFileAsync(snapshot, file, cancellationToken);
            using var stream = new MemoryStream(content, writable: false);
            sources.Add(file.Path, SourceText.From(stream, encoding: null, throwIfBinaryDetected: true));
        }
        return sources;
    }
}
