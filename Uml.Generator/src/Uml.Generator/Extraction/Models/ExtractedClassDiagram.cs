using Uml.Generator.Analysis.Models;
using Uml.Generator.Extraction.Class;
using Uml.Generator.Repository;

namespace Uml.Generator.Extraction.Models;

public sealed record ExtractedClassDiagram(string Id, string Title, SnapshotManifest Snapshot,
    ClassDiagramOptions Options, IReadOnlyList<ExtractedClass> Classes,
    IReadOnlyList<ExtractedRelationship> Relationships, IReadOnlyList<ExtractionDiagnostic> Diagnostics);

public sealed record ExtractionDiagnostic(string Code, string Message, string? SymbolId = null, SourceLocation? Source = null);
