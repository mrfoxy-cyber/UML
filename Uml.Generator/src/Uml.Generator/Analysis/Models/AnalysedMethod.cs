namespace Uml.Generator.Analysis.Models;

public sealed record AnalysedMethod(
    string Id,
    string DeclaringTypeId,
    string Name,
    string Signature,
    string Kind,
    TypeReference ReturnType,
    IReadOnlyList<AnalysedParameter> Parameters,
    IReadOnlyList<AnalysedTypeParameter> TypeParameters,
    IReadOnlyList<string> Modifiers,
    string CodeHash,
    IReadOnlyList<SourceLocation> Sources,
    MethodBody? Body);
