using Uml.Generator.Analysis.Models;
using Uml.Generator.Extraction.Models;

namespace Uml.Generator.Extraction.Class;

internal sealed class ClassRelationshipExtractor(ClassAnalysisIndex index, ClassDiagramOptions options,
    ISet<string> scope, List<ExtractionDiagnostic> diagnostics)
{
    private readonly Dictionary<(string Kind, string From, string To), List<RelationshipEvidence>> edges = [];
    private readonly HashSet<string> warnings = new(StringComparer.Ordinal);

    public IReadOnlyList<ExtractedRelationship> Extract(AnalysedProject project, CancellationToken cancellationToken)
    {
        foreach (var group in project.Compilations)
        {
            cancellationToken.ThrowIfCancellationRequested();
            foreach (var relationship in group.Relationships)
            {
                var mode = relationship.Kind switch { "inherits" => "inheritance", "implements" => "implementation", _ => relationship.Kind };
                if (!options.Relationships.Contains(mode) || !index.Owners.TryGetValue(relationship.FromId, out var owner) || !scope.Contains(owner)) continue;
                var kind = mode switch { "inheritance" or "implementation" => mode, "member-type" => "association", _ => "dependency" };
                AddType(owner, relationship.To, kind, new RelationshipEvidence(mode, relationship.FromId, relationship.Source));
            }
            foreach (var type in group.Types.Where(type => scope.Contains(type.Id)))
            {
                if (options.Relationships.Contains("generic-constraint"))
                {
                    foreach (var parameter in type.TypeParameters)
                    foreach (var target in parameter.TypeConstraints)
                        AddType(type.Id, target, "dependency", new RelationshipEvidence("generic-constraint", type.Id, type.Sources[0]));
                    foreach (var method in type.Methods.Where(method => method.Sources.Count > 0))
                    foreach (var parameter in method.TypeParameters)
                    foreach (var target in parameter.TypeConstraints)
                        AddType(type.Id, target, "dependency", new RelationshipEvidence("generic-constraint", method.Id, method.Sources[0]));
                }
                if (!options.Relationships.Contains("call")) continue;
                var bodies = type.Methods.Select(method => method.Body).Concat(type.Members.Select(member => member.Initializer));
                foreach (var call in bodies.Where(body => body != null).SelectMany(body => Calls(body!.Operations)))
                {
                    if (call.Resolution == "resolved" && call.TargetType != null)
                        AddType(type.Id, call.TargetType, "dependency", new RelationshipEvidence("call", call.CallerId, call.Source));
                    else Warn("CLASS_UNRESOLVED_CALL", "Call dependency omitted because its declaring type is unresolved.", call.CallerId, call.Source);
                }
            }
        }
        return edges.OrderBy(edge => edge.Key.From, StringComparer.Ordinal).ThenBy(edge => edge.Key.To, StringComparer.Ordinal)
            .ThenBy(edge => edge.Key.Kind, StringComparer.Ordinal).Select(edge => new ExtractedRelationship(
                edge.Key.Kind + "|" + edge.Key.From + "|" + edge.Key.To, edge.Key.Kind, edge.Key.From, edge.Key.To,
                edge.Value.Distinct().OrderBy(evidence => evidence.Source.File, StringComparer.Ordinal)
                    .ThenBy(evidence => evidence.Source.Start).ThenBy(evidence => evidence.Kind, StringComparer.Ordinal).ToArray())).ToArray();
    }

    private void AddType(string from, TypeReference target, string kind, RelationshipEvidence evidence, bool argument = false)
    {
        if (target.SymbolId == null)
            Warn("CLASS_UNRESOLVED_TYPE", "Unresolved type reference omitted: " + target.DisplayName, evidence.SymbolId, evidence.Source);
        else if (target.Kind is not ("TypeParameter" or "Array" or "Pointer" or "Dynamic") && !Primitive(target))
        {
            var id = target.SymbolId;
            if (!index.Types.ContainsKey(id) && options.Context.IncludeExternal && ClassAnalysisIndex.ViewerKind(target.Kind) != null)
            {
                var name = target.DefinitionName ?? ClassMemberFormatter.TypeName(target.DisplayName);
                var type = new AnalysedType(id, name, name, "External", target.Kind, [], [], [], [], []);
                index.Types.Add(id, new IndexedClass(type, "external", true));
            }
            if (index.Types.TryGetValue(id, out var entry) && (scope.Contains(id) || entry.External) && ClassAnalysisIndex.ViewerKind(entry.Type.Kind) != null)
            {
                // Generic arguments express usage, not inheritance from or implementation of the argument.
                var relationKind = argument && kind is "inheritance" or "implementation" ? "dependency" : kind;
                if (from != id)
                {
                    var key = (relationKind, from, id);
                    if (!edges.TryGetValue(key, out var reasons)) edges[key] = reasons = [];
                    reasons.Add(evidence);
                }
            }
            else Warn("CLASS_TARGET_OMITTED", "Relationship target is external, unsupported, excluded or outside the configured compilations: " + target.DisplayName,
                evidence.SymbolId, evidence.Source);
        }
        foreach (var child in target.TypeArguments) AddType(from, child, kind, evidence, argument: true);
    }

    private void Warn(string code, string message, string symbol, SourceLocation source)
    {
        if (warnings.Add(code + "|" + symbol + "|" + message)) diagnostics.Add(new ExtractionDiagnostic(code, message, symbol, source));
    }

    private static bool Primitive(TypeReference type) => type.SymbolId is { } id &&
        new[] { "Void", "Boolean", "Byte", "SByte", "Int16", "UInt16", "Int32", "UInt32", "Int64", "UInt64", "IntPtr", "UIntPtr", "Single", "Double", "Decimal", "Char", "String", "Object" }
            .Any(name => id.EndsWith("|T:System." + name, StringComparison.Ordinal));

    private static IEnumerable<CallSite> Calls(IEnumerable<BodyOperation> operations)
    {
        foreach (var operation in operations)
        {
            if (operation.Call != null) yield return operation.Call;
            foreach (var call in Calls(operation.Children)) yield return call;
        }
    }
}
