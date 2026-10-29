namespace Uml.Generator.Analysis.Models;

/// <summary>A location within the project snapshot, using a repository-relative file path.</summary>
public sealed record SourceLocation(string File, int Start, int Length, int StartLine, int StartColumn, int EndLine, int EndColumn);
