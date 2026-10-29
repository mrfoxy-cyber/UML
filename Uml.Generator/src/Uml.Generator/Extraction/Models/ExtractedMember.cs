using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Extraction.Models;

public sealed record ExtractedMember(string SymbolId, string Kind, string Name, string? CodeHash,
    IReadOnlyList<SourceLocation> Sources);
