using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;
using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Analysis.CSharp;

internal sealed class MethodBodyReader(SymbolIdentity identity, CancellationToken cancellationToken)
{
    public MethodBody? ReadInitializer(ISymbol member, CSharpCompilation compilation)
    {
        var operations = new List<BodyOperation>();
        foreach (var reference in member.DeclaringSyntaxReferences)
        {
            var syntax = reference.GetSyntax(cancellationToken);
            var initializer = syntax switch
            {
                VariableDeclaratorSyntax variable => variable.Initializer?.Value,
                PropertyDeclarationSyntax property => property.Initializer?.Value,
                _ => null
            };
            if (initializer != null)
                operations.Add(ReadOperation(initializer, compilation.GetSemanticModel(syntax.SyntaxTree), identity.Id(member)));
        }
        return operations.Count == 0 ? null : new MethodBody(operations);
    }

    public MethodBody? Read(IMethodSymbol method, Microsoft.CodeAnalysis.CSharp.CSharpCompilation compilation)
    {
        var implementation = method.PartialImplementationPart ?? method;
        var operations = new List<BodyOperation>();
        foreach (var reference in implementation.DeclaringSyntaxReferences)
        {
            var syntax = reference.GetSyntax(cancellationToken);
            var model = compilation.GetSemanticModel(syntax.SyntaxTree);
            SyntaxNode? body = syntax switch
            {
                BaseMethodDeclarationSyntax declaration => (SyntaxNode?)declaration.Body ?? declaration.ExpressionBody,
                AccessorDeclarationSyntax accessor => (SyntaxNode?)accessor.Body ?? accessor.ExpressionBody,
                ArrowExpressionClauseSyntax arrow => arrow,
                PropertyDeclarationSyntax property => property.ExpressionBody,
                IndexerDeclarationSyntax indexer => indexer.ExpressionBody,
                _ => null
            };
            if (syntax is ConstructorDeclarationSyntax { Initializer: { } initializer })
                operations.Add(ReadOperation(initializer, model, identity.Id(method)));
            if (body != null) operations.Add(ReadOperation(body, model, identity.Id(method)));
        }
        return operations.Count == 0 ? null : new MethodBody(operations);
    }

    private BodyOperation ReadOperation(SyntaxNode node, SemanticModel model, string caller, int depth = 0)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (depth >= 96)
            return new BodyOperation("DepthLimit", SymbolIdentity.Location(node), null, null, null, []);
        if (node is InvocationExpressionSyntax && model.GetOperation(node, cancellationToken) is INameOfOperation)
            return new BodyOperation("NameOf", SymbolIdentity.Location(node), node.ToString(), null, null, []);
        var kind = node.Kind().ToString();
        string? scopeId = null;
        if (node is LocalFunctionStatementSyntax local)
        {
            caller = identity.Id(model.GetDeclaredSymbol(local, cancellationToken)!);
            kind = "DeferredLocalFunction";
            scopeId = caller;
        }
        else if (node is AnonymousFunctionExpressionSyntax && model.GetOperation(node, cancellationToken) is IAnonymousFunctionOperation lambda)
        {
            caller = identity.Id(lambda.Symbol);
            kind = "DeferredLambda";
            scopeId = caller;
        }
        var call = node is InvocationExpressionSyntax or BaseObjectCreationExpressionSyntax or ConstructorInitializerSyntax
            ? ReadCall(node, model, caller) : null;
        return new BodyOperation(kind, SymbolIdentity.Location(node), Label(node), scopeId, call,
            ReadChildren(node, model, caller, depth + 1).ToArray());
    }

    private IEnumerable<BodyOperation> ReadChildren(SyntaxNode parent, SemanticModel model, string caller, int depth)
    {
        foreach (var child in parent.ChildNodes())
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (depth >= 96 || Keep(child)) yield return ReadOperation(child, model, caller, depth);
            else foreach (var operation in ReadChildren(child, model, caller, depth + 1)) yield return operation;
        }
    }

    private static bool Keep(SyntaxNode node) => node is StatementSyntax or ElseClauseSyntax or SwitchSectionSyntax or
        CatchClauseSyntax or CatchFilterClauseSyntax or FinallyClauseSyntax or ArrowExpressionClauseSyntax or
        InvocationExpressionSyntax or BaseObjectCreationExpressionSyntax or ConstructorInitializerSyntax or
        AnonymousFunctionExpressionSyntax or AwaitExpressionSyntax or ConditionalExpressionSyntax or
        ConditionalAccessExpressionSyntax or SwitchExpressionSyntax or SwitchExpressionArmSyntax or
        AssignmentExpressionSyntax or ThrowExpressionSyntax ||
        node.IsKind(SyntaxKind.LogicalAndExpression) || node.IsKind(SyntaxKind.LogicalOrExpression) || node.IsKind(SyntaxKind.CoalesceExpression);

    private static string? Label(SyntaxNode node) => node switch
    {
        IfStatementSyntax statement => statement.Condition.ToString(),
        WhileStatementSyntax statement => statement.Condition.ToString(),
        DoStatementSyntax statement => statement.Condition.ToString(),
        ForStatementSyntax statement => statement.Condition?.ToString(),
        ForEachStatementSyntax statement => statement.Identifier + " in " + statement.Expression,
        SwitchStatementSyntax statement => statement.Expression.ToString(),
        SwitchSectionSyntax section => string.Join(" ", section.Labels.Select(label => label.ToString())),
        SwitchExpressionSyntax expression => expression.GoverningExpression.ToString(),
        SwitchExpressionArmSyntax arm => arm.Pattern.ToString(),
        ConditionalExpressionSyntax expression => expression.Condition.ToString(),
        ReturnStatementSyntax statement => statement.Expression?.ToString(),
        ThrowStatementSyntax statement => statement.Expression?.ToString(),
        CatchClauseSyntax clause => clause.Declaration?.ToString(),
        CatchFilterClauseSyntax clause => clause.FilterExpression.ToString(),
        LocalDeclarationStatementSyntax statement => statement.Declaration.ToString(),
        AssignmentExpressionSyntax expression => expression.Left.ToString(),
        _ => null
    };

    private CallSite ReadCall(SyntaxNode node, SemanticModel model, string caller)
    {
        var info = model.GetSymbolInfo(node, cancellationToken);
        var target = info.Symbol as IMethodSymbol;
        var candidates = info.CandidateSymbols.Select(identity.Id).Distinct().Order(StringComparer.Ordinal).ToArray();
        var resolution = target != null ? "resolved" : candidates.Length > 1 ? "ambiguous" : "unresolved";
        var arguments = node switch
        {
            InvocationExpressionSyntax invocation => invocation.ArgumentList.Arguments,
            ObjectCreationExpressionSyntax creation => creation.ArgumentList?.Arguments ?? default,
            ImplicitObjectCreationExpressionSyntax creation => creation.ArgumentList.Arguments,
            ConstructorInitializerSyntax initializer => initializer.ArgumentList.Arguments,
            _ => default
        };
        var receiver = node is InvocationExpressionSyntax { Expression: MemberAccessExpressionSyntax member }
            ? member.Expression.ToString() : null;
        var dispatch = target switch
        {
            null => "unknown",
            { MethodKind: MethodKind.Constructor } => "constructor",
            { MethodKind: MethodKind.DelegateInvoke } => "delegate",
            { ContainingType.TypeKind: TypeKind.Interface } => "interface",
            { IsVirtual: true } or { IsOverride: true } or { IsAbstract: true } => "virtual",
            _ => "direct"
        };
        return new CallSite(caller, target == null ? null : identity.Id(target), node.ToString(), receiver,
            arguments.Select(argument => argument.ToString()).ToArray(), resolution, candidates, dispatch, SymbolIdentity.Location(node),
            target == null ? null : identity.Type(target.ContainingType));
    }
}
