using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Extraction.Models;

public sealed record ExtractedClass(string SymbolId, string Name, string Kind, string Namespace,
    string Compilation, bool IsContext, bool IsExternal, string? Notes,
    IReadOnlyList<ExtractedMember> Members, IReadOnlyList<SourceLocation> Sources, bool IsAbstract = false);
