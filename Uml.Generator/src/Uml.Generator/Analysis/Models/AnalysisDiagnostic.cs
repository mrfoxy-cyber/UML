namespace Uml.Generator.Analysis.Models;

public sealed record AnalysisDiagnostic(string Code, string Severity, string Message, SourceLocation? Source);
