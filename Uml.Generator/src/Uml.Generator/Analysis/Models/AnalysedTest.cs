namespace Uml.Generator.Analysis.Models;

public sealed record AnalysedTest(
    string Id,
    string MethodId,
    string Name,
    string Framework,
    string Detection,
    IReadOnlyList<string> Attributes,
    IReadOnlyList<UmlAnnotation> Annotations);
