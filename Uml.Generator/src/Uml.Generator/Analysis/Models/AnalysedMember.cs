namespace Uml.Generator.Analysis.Models;

public sealed record AnalysedMember(string Id, string Name, string Kind, TypeReference Type,
    IReadOnlyList<string> Modifiers, IReadOnlyList<SourceLocation> Sources, MethodBody? Initializer);

public sealed record AnalysedParameter(string Name, TypeReference Type, string RefKind, bool Optional);
