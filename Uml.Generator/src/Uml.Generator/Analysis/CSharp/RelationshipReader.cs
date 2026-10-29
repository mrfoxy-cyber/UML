using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Analysis.CSharp;

internal sealed class RelationshipReader(SymbolIdentity identity, CancellationToken cancellationToken)
{
    public IReadOnlyList<CodeRelationship> Read(CSharpCompilation compilation, IReadOnlyList<AnalysedType> types)
    {
        var relationships = new List<CodeRelationship>();
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            foreach (var declaration in tree.GetRoot(cancellationToken).DescendantNodes().OfType<BaseTypeDeclarationSyntax>())
            {
                if (declaration.BaseList == null || model.GetDeclaredSymbol(declaration, cancellationToken) is not INamedTypeSymbol owner) continue;
                foreach (var baseType in declaration.BaseList.Types)
                {
                    var target = model.GetTypeInfo(baseType.Type, cancellationToken).Type;
                    if (target == null) continue;
                    var kind = target.TypeKind == TypeKind.Error ? "base-type" :
                        target.TypeKind == TypeKind.Interface && owner.TypeKind != TypeKind.Interface ? "implements" : "inherits";
                    relationships.Add(new CodeRelationship(kind, identity.Id(owner), identity.Type(target), SymbolIdentity.Location(baseType)));
                }
            }
        }
        foreach (var type in types)
        {
            foreach (var member in type.Members)
                relationships.Add(new CodeRelationship("member-type", member.Id, member.Type, member.Sources[0]));
            foreach (var method in type.Methods)
            {
                if (method.Sources.Count == 0) continue;
                relationships.Add(new CodeRelationship("returns", method.Id, method.ReturnType, method.Sources[0]));
                foreach (var parameter in method.Parameters)
                    relationships.Add(new CodeRelationship("parameter-type", method.Id, parameter.Type, method.Sources[0]));
            }
        }
        return relationships.OrderBy(relation => relation.Source.File, StringComparer.Ordinal)
            .ThenBy(relation => relation.Source.Start).ThenBy(relation => relation.Kind, StringComparer.Ordinal).ToArray();
    }
}
