namespace Uml.Generator.Analysis.Models;

public sealed record CallSite(string CallerId, string? TargetId, string Expression, string? Receiver,
    IReadOnlyList<string> Arguments, string Resolution, IReadOnlyList<string> Candidates,
    string Dispatch, SourceLocation Source, TypeReference? TargetType = null);
