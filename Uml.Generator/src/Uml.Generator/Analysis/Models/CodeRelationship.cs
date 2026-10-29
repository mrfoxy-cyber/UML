namespace Uml.Generator.Analysis.Models;

public sealed record CodeRelationship(string Kind, string FromId, TypeReference To, SourceLocation Source);
