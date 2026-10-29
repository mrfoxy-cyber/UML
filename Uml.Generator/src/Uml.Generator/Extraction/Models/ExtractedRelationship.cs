using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Extraction.Models;

public sealed record ExtractedRelationship(string Identity, string Kind, string FromId, string ToId,
    IReadOnlyList<RelationshipEvidence> Evidence);

public sealed record RelationshipEvidence(string Kind, string SymbolId, SourceLocation Source);
