using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Analysis.CSharp;

internal sealed class DeclarationReader(SymbolIdentity identity, CancellationToken cancellationToken)
{
    public IReadOnlyList<AnalysedType> Read(CSharpCompilation compilation)
    {
        var types = new HashSet<INamedTypeSymbol>(SymbolEqualityComparer.Default);
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            foreach (var node in tree.GetRoot(cancellationToken).DescendantNodes()
                         .Where(node => node is BaseTypeDeclarationSyntax or DelegateDeclarationSyntax))
                if (model.GetDeclaredSymbol(node, cancellationToken) is INamedTypeSymbol type) types.Add(type);
        }
        return types.Select(type => ReadType(type, compilation)).OrderBy(type => type.Id, StringComparer.Ordinal).ToArray();
    }

    private AnalysedType ReadType(INamedTypeSymbol type, CSharpCompilation compilation)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var members = type.GetMembers().Where(member => !member.IsImplicitlyDeclared).ToArray();
        var fields = members.Where(member => member is IFieldSymbol or IPropertySymbol or IEventSymbol)
            .Select(member => new AnalysedMember(identity.Id(member), member.Name, member.Kind.ToString(), identity.Type(member switch
            {
                IFieldSymbol field => field.Type,
                IPropertySymbol property => property.Type,
                IEventSymbol @event => @event.Type,
                _ => throw new InvalidOperationException("Unexpected member kind.")
            }), SymbolIdentity.Modifiers(member), SymbolIdentity.Sources(member),
                new MethodBodyReader(identity, cancellationToken).ReadInitializer(member, compilation)))
            .OrderBy(member => member.Id, StringComparer.Ordinal).ToArray();
        var methods = members.OfType<IMethodSymbol>().Where(method => method.PartialDefinitionPart == null)
            .Select(method => ReadMethod(method, compilation)).OrderBy(method => method.Id, StringComparer.Ordinal).ToArray();
        return new AnalysedType(identity.Id(type), type.Name, type.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat),
            type.ContainingNamespace.ToDisplayString(), type.TypeKind.ToString(), SymbolIdentity.Modifiers(type),
            identity.TypeParameters(type.TypeParameters), fields, methods, SymbolIdentity.Sources(type));
    }

    private AnalysedMethod ReadMethod(IMethodSymbol method, CSharpCompilation compilation)
    {
        var declarations = method.DeclaringSyntaxReferences
            .Concat(method.PartialImplementationPart?.DeclaringSyntaxReferences ?? [])
            .Select(reference => reference.GetSyntax(cancellationToken))
            .OrderBy(node => node.SyntaxTree.FilePath, StringComparer.Ordinal).ThenBy(node => node.SpanStart).ToArray();
        return new AnalysedMethod(identity.Id(method), identity.Id(method.ContainingType), method.Name,
            method.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat), method.MethodKind.ToString(),
            identity.Type(method.ReturnType), method.Parameters.Select(parameter => new AnalysedParameter(parameter.Name,
                identity.Type(parameter.Type), parameter.RefKind.ToString(), parameter.IsOptional)).ToArray(),
            identity.TypeParameters(method.TypeParameters),
            SymbolIdentity.Modifiers(method), SymbolIdentity.Fingerprint(declarations),
            declarations.Select(SymbolIdentity.Location).ToArray(), new MethodBodyReader(identity, cancellationToken).Read(method, compilation));
    }
}
