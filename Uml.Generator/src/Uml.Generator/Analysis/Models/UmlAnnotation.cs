namespace Uml.Generator.Analysis.Models;

public sealed record UmlAnnotation(string Type, string? Id, string? Title, SourceLocation Source);
