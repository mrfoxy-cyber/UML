namespace Uml.Generator.Analysis.Input;

public sealed record AnalysisOptions(IReadOnlyList<CompilationOptions> Compilations)
{
    public static AnalysisOptions Default { get; } = new([
        new("source", ["**/*.cs"], [], "default", [], [])
    ]);
}

public sealed record CompilationOptions(string Id, IReadOnlyList<string> Include,
    IReadOnlyList<string> References, string LanguageVersion, IReadOnlyList<string> Defines,
    IReadOnlyList<string> GlobalUsings, string Nullable = "disable");
