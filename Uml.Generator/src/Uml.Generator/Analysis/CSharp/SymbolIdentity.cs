using System.Security.Cryptography;
using System.Text;
using Microsoft.CodeAnalysis;
using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Analysis.CSharp;

internal sealed class SymbolIdentity(string repository, IEnumerable<string> compilationIds)
{
    private readonly Dictionary<string, string> assemblies = compilationIds.ToDictionary(id => "uml_" + id, id => id, StringComparer.Ordinal);

    public string Id(ISymbol symbol)
    {
        if (symbol is IMethodSymbol method) symbol = method.ReducedFrom ?? method;
        symbol = symbol.OriginalDefinition;
        var assembly = symbol.ContainingAssembly?.Name ?? "unknown";
        var scope = assemblies.TryGetValue(assembly, out var group) ? repository + "/" + group : "external/" + assembly;
        var declaration = symbol.GetDocumentationCommentId();
        if (declaration == null)
        {
            var location = symbol.Locations.FirstOrDefault(location => location.IsInSource);
            declaration = symbol.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat) + "@" +
                location?.SourceTree?.FilePath + ":" + location?.SourceSpan.Start;
        }
        return scope + "|" + declaration;
    }

    public TypeReference Type(ITypeSymbol type)
    {
        var arguments = type switch
        {
            INamedTypeSymbol named => named.TypeArguments.Select(Type).ToArray(),
            IArrayTypeSymbol array => [Type(array.ElementType)],
            IPointerTypeSymbol pointer => [Type(pointer.PointedAtType)],
            _ => Array.Empty<TypeReference>()
        };
        var unresolved = type.TypeKind == TypeKind.Error || arguments.Any(argument => argument.Resolution == "unresolved");
        return new TypeReference(type.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat),
            unresolved ? null : Id(type), unresolved ? "unresolved" : "resolved", arguments);
    }

    public static string Fingerprint(IEnumerable<SyntaxNode> declarations)
    {
        // Length prefixes distinguish tokens without depending on formatting or comments.
        var tokens = declarations.SelectMany(node => node.DescendantTokens())
            .Select(token => token.RawKind + ":" + token.Text.Length + ":" + token.Text);
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("|", tokens))));
    }

    public IReadOnlyList<AnalysedTypeParameter> TypeParameters(IEnumerable<ITypeParameterSymbol> parameters) => parameters.Select(parameter =>
    {
        var constraints = new List<string>();
        if (parameter.HasConstructorConstraint) constraints.Add("new()");
        if (parameter.HasReferenceTypeConstraint) constraints.Add("class");
        if (parameter.HasValueTypeConstraint) constraints.Add("struct");
        if (parameter.HasNotNullConstraint) constraints.Add("notnull");
        if (parameter.HasUnmanagedTypeConstraint) constraints.Add("unmanaged");
        return new AnalysedTypeParameter(parameter.Name, parameter.Variance.ToString(), constraints,
            parameter.ConstraintTypes.Select(Type).ToArray());
    }).ToArray();

    public static SourceLocation Location(SyntaxNode node) => Location(node.GetLocation());

    public static SourceLocation Location(Location location)
    {
        var lines = location.GetLineSpan();
        return new SourceLocation(lines.Path, location.SourceSpan.Start, location.SourceSpan.Length,
            lines.StartLinePosition.Line + 1, lines.StartLinePosition.Character + 1,
            lines.EndLinePosition.Line + 1, lines.EndLinePosition.Character + 1);
    }

    public static IReadOnlyList<SourceLocation> Sources(ISymbol symbol) => symbol.DeclaringSyntaxReferences
        .Select(reference => Location(reference.GetSyntax())).OrderBy(location => location.File, StringComparer.Ordinal)
        .ThenBy(location => location.Start).ToArray();

    public static IReadOnlyList<string> Modifiers(ISymbol symbol)
    {
        var values = new List<string> { symbol.DeclaredAccessibility.ToString() };
        if (symbol.IsStatic) values.Add("static");
        if (symbol.IsAbstract) values.Add("abstract");
        if (symbol.IsVirtual) values.Add("virtual");
        if (symbol.IsOverride) values.Add("override");
        if (symbol.IsSealed) values.Add("sealed");
        if (symbol is IMethodSymbol { IsAsync: true }) values.Add("async");
        if (symbol is INamedTypeSymbol { IsRecord: true }) values.Add("record");
        if (symbol is INamedTypeSymbol { IsReadOnly: true }) values.Add("readonly");
        if (symbol is INamedTypeSymbol { IsRefLikeType: true }) values.Add("ref");
        if (symbol is IFieldSymbol { IsReadOnly: true }) values.Add("readonly");
        if (symbol is IFieldSymbol { IsConst: true }) values.Add("const");
        if (symbol is IFieldSymbol { IsVolatile: true }) values.Add("volatile");
        if (symbol is IMethodSymbol { IsInitOnly: true }) values.Add("init");
        if (symbol is IPropertySymbol { IsRequired: true }) values.Add("required");
        return values;
    }
}
