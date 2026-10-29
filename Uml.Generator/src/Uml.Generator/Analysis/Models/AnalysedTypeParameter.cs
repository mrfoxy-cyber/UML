namespace Uml.Generator.Analysis.Models;

public sealed record AnalysedTypeParameter(string Name, string Variance, IReadOnlyList<string> Constraints,
    IReadOnlyList<TypeReference> TypeConstraints);
