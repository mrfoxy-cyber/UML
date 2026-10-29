namespace Uml.Generator.Analysis.Models;

/// <summary>Lexical nesting, not a runtime execution trace. Children retain source order.</summary>
public sealed record BodyOperation(string Kind, SourceLocation Source, string? Label, string? ScopeId, CallSite? Call,
    IReadOnlyList<BodyOperation> Children);
