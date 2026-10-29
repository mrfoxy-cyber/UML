namespace Uml.Generator.Analysis.Models;

public sealed record TypeReference(string DisplayName, string? SymbolId, string Resolution,
    IReadOnlyList<TypeReference> TypeArguments);
