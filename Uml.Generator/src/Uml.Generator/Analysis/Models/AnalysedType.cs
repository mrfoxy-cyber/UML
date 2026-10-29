namespace Uml.Generator.Analysis.Models;

public sealed record AnalysedType(
    string Id,
    string Name,
    string DisplayName,
    string Namespace,
    string Kind,
    IReadOnlyList<string> Modifiers,
    IReadOnlyList<AnalysedTypeParameter> TypeParameters,
    IReadOnlyList<AnalysedMember> Members,
    IReadOnlyList<AnalysedMethod> Methods,
    IReadOnlyList<SourceLocation> Sources);
