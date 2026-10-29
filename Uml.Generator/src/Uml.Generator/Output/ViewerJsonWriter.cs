using System.Text.Json;
using System.Text.Json.Serialization;
using Uml.Generator.Extraction.Class;
using Uml.Generator.Extraction.Models;
using Uml.Generator.Repository;

namespace Uml.Generator.Output;

public sealed record ViewerExport(string Directory, string Diagram, string Provenance, string Details);

/// <summary>Publishes one immutable draft directory containing a diagram and JSON/HTML provenance.</summary>
public sealed class ViewerJsonWriter
{
    public async Task<ViewerExport> WriteAsync(string workspace, ExtractedClassDiagram diagram, CancellationToken cancellationToken = default)
    {
        var built = new ViewerDocumentBuilder().Build(diagram);
        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
        var content = JsonSerializer.Serialize(built.Document, jsonOptions) + "\n";
        if (System.Text.Encoding.UTF8.GetByteCount(content) > 4 * 1024 * 1024)
            throw new InvalidDataException("Diagram exceeds the viewer's 4 MB input limit. Narrow the selection or member detail.");
        var provenance = JsonSerializer.Serialize(new
        {
            Version = 1, diagram.Snapshot, diagram.Options,
            Identities = built.Ids.Identities,
            Classes = diagram.Classes.Select(type => new
            {
                Id = built.Ids.Map("type", type.SymbolId), type.SymbolId, type.Compilation, type.IsContext, type.IsExternal, type.IsAbstract, type.Sources,
                Members = type.Members.Select(member => new { Id = built.Ids.Map("member", member.SymbolId), member.SymbolId, member.CodeHash, member.Sources })
            }),
            Relationships = diagram.Relationships.Select(edge => new { Id = built.Ids.Map("relation", edge.Identity), edge.Evidence }),
            diagram.Diagnostics
        }, jsonOptions) + "\n";
        var details = ProvenanceReport.Render(diagram, provenance);
        var key = diagram.Snapshot.SelectionHash;
        if (key.Length != 64 || key.Any(character => !char.IsAsciiHexDigit(character))) throw new InvalidDataException("Invalid snapshot identity.");
        ClassOptionsValidator.RequireId(diagram.Id);
        var root = Path.Combine(Path.GetFullPath(workspace), "output", "classes", key, diagram.Id);
        SnapshotCachePaths.EnsureNoLinks(root);
        Directory.CreateDirectory(root);
        var bytes = System.Text.Encoding.UTF8.GetBytes(content + provenance + details);
        var exportKey = GitObjectHash.Content(bytes);
        var destination = Path.Combine(root, exportKey);
        SnapshotCachePaths.EnsureNoLinks(destination);
        var diagramPath = Path.Combine(destination, diagram.Id + ".uml.json");
        var provenancePath = Path.Combine(destination, "provenance.json");
        var detailsPath = Path.Combine(destination, "provenance.html");
        if (Directory.Exists(destination))
        {
            SnapshotCachePaths.EnsureNoLinks(diagramPath);
            SnapshotCachePaths.EnsureNoLinks(provenancePath);
            SnapshotCachePaths.EnsureNoLinks(detailsPath);
            if (await File.ReadAllTextAsync(diagramPath, cancellationToken) != content ||
                await File.ReadAllTextAsync(provenancePath, cancellationToken) != provenance ||
                await File.ReadAllTextAsync(detailsPath, cancellationToken) != details)
                throw new InvalidDataException("Previously generated draft has changed. Preserve your edits and generate into a clean export directory.");
            return new ViewerExport(destination, diagramPath, provenancePath, detailsPath);
        }
        var staging = Path.Combine(root, ".pending-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(staging);
        try
        {
            await File.WriteAllTextAsync(Path.Combine(staging, diagram.Id + ".uml.json"), content, cancellationToken);
            await File.WriteAllTextAsync(Path.Combine(staging, "provenance.json"), provenance, cancellationToken);
            await File.WriteAllTextAsync(Path.Combine(staging, "provenance.html"), details, cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            Directory.Move(staging, destination);
            return new ViewerExport(destination, diagramPath, provenancePath, detailsPath);
        }
        finally
        {
            if (Directory.Exists(staging))
            {
                foreach (var file in Directory.EnumerateFiles(staging)) File.Delete(file);
                Directory.Delete(staging);
            }
        }
    }
}
