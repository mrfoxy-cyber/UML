using Uml.Generator.Analysis.Input;

namespace Uml.Generator.Analysis.Models;

public sealed record AnalysedCompilation(
    string Id,
    CompilationOptions Options,
    IReadOnlyList<string> Files,
    IReadOnlyList<AnalysedType> Types,
    IReadOnlyList<CodeRelationship> Relationships,
    IReadOnlyList<AnalysedTest> Tests,
    IReadOnlyList<AnalysisDiagnostic> Diagnostics);
