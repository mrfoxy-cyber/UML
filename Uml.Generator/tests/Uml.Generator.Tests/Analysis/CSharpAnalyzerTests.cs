using System.Text.Json;
using Uml.Generator.Analysis;
using Uml.Generator.Analysis.Input;
using Uml.Generator.Analysis.Models;
using Uml.Generator.Output;
using Uml.Generator.Tests.Repository;
using Xunit;

namespace Uml.Generator.Tests.Analysis;

public sealed class CSharpAnalyzerTests
{
    [Fact]
    public async Task ReadsNestedAndPartialTypesAndMemberSignatures()
    {
        var project = await Analyze(new Dictionary<string, string>
        {
            ["App/A.cs"] = "namespace Garage; public partial class Car<T> { public T Value { get; set; } public class Engine {} }",
            ["App/B.cs"] = "namespace Garage; public partial class Car<T> { public T Drive(ref T value) => value; }"
        });
        var car = Assert.Single(project.Compilations[0].Types, type => type.Name == "Car");
        Assert.Equal(2, car.Sources.Count);
        Assert.Contains(project.Compilations[0].Types, type => type.Name == "Engine");
        Assert.Contains(car.Members, member => member.Name == "Value" && member.Kind == "Property");
        var drive = Assert.Single(car.Methods, method => method.Name == "Drive");
        Assert.Equal("Ref", drive.Parameters[0].RefKind);
        Assert.Equal(car.Id, drive.DeclaringTypeId);
        Assert.All(car.Sources, source => { Assert.StartsWith("App/", source.File); Assert.True(source.StartLine >= 1); Assert.True(source.Length > 0); });
    }

    [Fact]
    public async Task ResolvesOverloadsUsingSymbolsInsteadOfNames()
    {
        var project = await Analyze("class C { void Park(int n) {} void Park(string s) {} void Run() { Park(1); Park(\"x\"); } }");
        var type = project.Compilations[0].Types[0];
        var calls = Calls(Method(project, "Run")).ToArray();
        Assert.Equal(2, calls.Length);
        Assert.All(calls, call => Assert.Equal("resolved", call.Resolution));
        Assert.NotEqual(calls[0].TargetId, calls[1].TargetId);
        Assert.Contains(type.Methods, method => method.Id == calls[0].TargetId && method.Parameters[0].Type.DisplayName == "int");
    }

    [Fact]
    public async Task BodyEditsChangeFingerprintButFormattingDoesNot()
    {
        var first = Method(await Analyze("class C { int M() => 1; }"), "M");
        var formatted = Method(await Analyze("class C {\n int M ( ) /* comment */ => 1 ;\n}"), "M");
        var changed = Method(await Analyze("class C { int M() => 2; }"), "M");
        Assert.Equal(first.Id, formatted.Id);
        Assert.Equal(first.CodeHash, formatted.CodeHash);
        Assert.Equal(first.Id, changed.Id);
        Assert.NotEqual(first.CodeHash, changed.CodeHash);
    }

    [Fact]
    public async Task PreservesConditionalLoopAndReturnStructure()
    {
        var project = await Analyze("class C { void Park() {} int Run(bool ok) { if(ok) { while(ok) Park(); } else return 0; return 1; } }");
        var method = Method(project, "Run");
        var branch = Assert.Single(Walk(method.Body!.Operations), operation => operation.Kind == "IfStatement");
        Assert.Contains(Walk(branch.Children), operation => operation.Kind == "WhileStatement");
        Assert.Contains(Walk(branch.Children), operation => operation.Kind == "ElseClause");
        Assert.Single(Calls(method));
    }

    [Fact]
    public async Task UnresolvedAndAmbiguousCallsNeverGetInventedTargets()
    {
        var project = await Analyze("class C { void M(string x) {} void M(System.Text.StringBuilder x) {} void Run() { Missing(); M(null); } }");
        var calls = Calls(Method(project, "Run")).ToArray();
        Assert.Equal("unresolved", calls[0].Resolution);
        Assert.Null(calls[0].TargetId);
        Assert.Equal("ambiguous", calls[1].Resolution);
        Assert.Null(calls[1].TargetId);
        Assert.Equal(2, calls[1].Candidates.Count);
        Assert.Contains(project.Compilations[0].Diagnostics, diagnostic => diagnostic.Code == "UML003");
    }

    [Fact]
    public async Task ResolvesCrossCompilationSymbolsWithMatchingIds()
    {
        var options = new AnalysisOptions([Group("domain", ["Domain/**/*.cs"]), Group("app", ["App/**/*.cs"], ["domain"])]);
        var project = await Analyze(new Dictionary<string, string>
        {
            ["Domain/Car.cs"] = "namespace Domain; public class Car { public void Park() {} }",
            ["App/C.cs"] = "class C { void Run(Domain.Car car) { car.Park(); } }"
        }, options);
        var target = project.Compilations.Single(group => group.Id == "domain").Types[0].Methods.Single(method => method.Name == "Park");
        var caller = project.Compilations.Single(group => group.Id == "app").Types[0].Methods.Single(method => method.Name == "Run");
        Assert.Equal(target.Id, Assert.Single(Calls(caller)).TargetId);
        Assert.DoesNotContain(project.Compilations.SelectMany(group => group.Diagnostics), diagnostic => diagnostic.Severity == "error");
    }

    [Fact]
    public async Task InterfaceDispatchDoesNotGuessRuntimeImplementation()
    {
        var project = await Analyze("interface IPark { void Park(); } class C { void Run(IPark park) { park.Park(); } }");
        var call = Assert.Single(Calls(Method(project, "Run")));
        Assert.Equal("interface", call.Dispatch);
        Assert.Equal(project.Compilations[0].Types.Single(type => type.Name == "IPark").Methods[0].Id, call.TargetId);
    }

    [Fact]
    public async Task ExtractsInheritanceAndMemberUsageWithoutInferringOwnership()
    {
        var project = await Analyze("interface I {} class Base {} class C : Base, I { Base item = new Base(); }");
        var relationships = project.Compilations[0].Relationships;
        Assert.Contains(relationships, relation => relation.Kind == "inherits");
        Assert.Contains(relationships, relation => relation.Kind == "implements");
        Assert.Contains(relationships, relation => relation.Kind == "member-type");
        Assert.DoesNotContain(relationships, relation => relation.Kind is "composition" or "aggregation");
    }

    [Fact]
    public async Task RecognizesTestAnnotationsWithMissingFrameworkDependencies()
    {
        var project = await Analyze(new Dictionary<string, string>
        {
            ["Tests/Parking.cs"] = """
                class ParkingTests {
                    // [uml: sequence id: parking title: Parking a vehicle]
                    // [uml: usecase id: UC-PARK]
                    [Fact]
                    public void Parks() {}
                }
                """
        });
        var test = Assert.Single(project.Compilations[0].Tests);
        Assert.Equal("xunit", test.Framework);
        Assert.Equal("syntax-unresolved", test.Detection);
        Assert.Equal(2, test.Annotations.Count);
        Assert.Equal("Parking a vehicle", test.Annotations[0].Title);
        Assert.Equal("UC-PARK", test.Annotations[1].Id);
        Assert.Equal(Method(project, "Parks").Id, test.MethodId);
    }

    [Fact]
    public async Task DoesNotMistakeAnUnrelatedResolvedFactAttributeForATest()
    {
        var project = await Analyze(new Dictionary<string, string>
        {
            ["Tests/Other.cs"] = "class FactAttribute : System.Attribute {} class C { [Fact] void M() {} }"
        });
        Assert.Empty(project.Compilations[0].Tests);
    }

    [Fact]
    public async Task InvalidAnnotationProducesDiagnostic()
    {
        var project = await Analyze(new Dictionary<string, string>
        {
            ["Tests/C.cs"] = "class C {\n // [uml: nonsense title: bad]\n [Fact] void M() {} }"
        });
        Assert.Empty(Assert.Single(project.Compilations[0].Tests).Annotations);
        Assert.Contains(project.Compilations[0].Diagnostics, diagnostic => diagnostic.Code == "UML001");
    }

    [Fact]
    public async Task RetainsMalformedCodeDiagnosticsAndMissingTypeResolution()
    {
        var project = await Analyze("class C { MissingType field; void M() { Broken( ; } }");
        Assert.NotEmpty(project.Compilations[0].Types);
        Assert.Contains(project.Compilations[0].Diagnostics, diagnostic => diagnostic.Severity == "error");
        Assert.Equal("unresolved", project.Compilations[0].Types[0].Members[0].Type.Resolution);
    }

    [Fact]
    public async Task DeferredBodiesHaveTheirOwnCallScopes()
    {
        var project = await Analyze("class C { void Park() {} void Run() { void Local() { Park(); } System.Action a = () => Park(); Local(); } }");
        var run = Method(project, "Run");
        var operations = Walk(run.Body!.Operations).ToArray();
        Assert.Contains(operations, operation => operation.Kind == "DeferredLocalFunction" && operation.ScopeId != run.Id);
        Assert.Contains(operations, operation => operation.Kind == "DeferredLambda" && operation.ScopeId != run.Id);
        Assert.Equal(1, Calls(run).Count(call => call.CallerId == run.Id));
    }

    [Fact]
    public async Task RecognizesConstructorAndExpressionGetterCalls()
    {
        var project = await Analyze("class C { public C(int n) {} int M() => 1; int Value => M(); C Make() => new C(1); }");
        Assert.Equal("constructor", Assert.Single(Calls(Method(project, "Make"))).Dispatch);
        Assert.Single(Calls(Method(project, "get_Value")));
    }

    [Theory]
    [InlineData("overlap")]
    [InlineData("omission")]
    [InlineData("cycle")]
    [InlineData("missing-reference")]
    public async Task RejectsInvalidCompilationBoundaries(string error)
    {
        var groups = error switch
        {
            "overlap" => new[] { Group("a", ["**/*.cs"]), Group("b", ["**/*.cs"]) },
            "omission" => [Group("a", ["App/**/*.cs"])],
            "cycle" => [Group("a", ["App/**/*.cs"], ["b"]), Group("b", ["Domain/**/*.cs"], ["a"])],
            _ => [Group("a", ["**/*.cs"], ["missing"])]
        };
        var exception = await Assert.ThrowsAsync<InvalidDataException>(() => Analyze(new Dictionary<string, string>
            { ["App/C.cs"] = "class C {}", ["Domain/D.cs"] = "class D {}" }, new AnalysisOptions(groups)));
        var message = error switch { "overlap" => "multiple compilations", "omission" => "no analysis compilation", "cycle" => "cycle", _ => "Unknown compilation reference" };
        Assert.Contains(message, exception.Message);
    }

    [Fact]
    public async Task RecordsGenericConstraintsAndMemberInitializers()
    {
        var project = await Analyze("class C<T> where T : class, new() { readonly object item = new object(); T M<U>(U value) where U : System.IDisposable => new T(); }");
        var type = Assert.Single(project.Compilations[0].Types);
        Assert.Equal("C<T>", type.DisplayName);
        Assert.Contains("new()", Assert.Single(type.TypeParameters).Constraints);
        var member = Assert.Single(type.Members);
        Assert.Contains("readonly", member.Modifiers);
        var call = Assert.Single(Walk(member.Initializer!.Operations), operation => operation.Call != null).Call!;
        Assert.Equal(member.Id, call.CallerId);
        Assert.Equal("resolved", call.Resolution);
        Assert.Contains("IDisposable", Assert.Single(Method(project, "M").TypeParameters).TypeConstraints[0].DisplayName);
    }

    [Fact]
    public async Task NameOfArgumentsNeverBecomeRuntimeCalls()
    {
        var project = await Analyze("class C { string M() => nameof(System.Console.WriteLine); }");
        Assert.Empty(Calls(Method(project, "M")));
        Assert.DoesNotContain(project.Compilations[0].Diagnostics, diagnostic => diagnostic.Code == "UML003");
    }

    [Fact]
    public async Task SupportsSemanticallyResolvedTestAttributes()
    {
        var project = await Analyze(new Dictionary<string, string>
        {
            ["Tests/C.cs"] = "namespace Xunit { public class TheoryAttribute : System.Attribute {} } class C { [Xunit.Theory] void M() {} }"
        });
        var test = Assert.Single(project.Compilations[0].Tests);
        Assert.Equal("semantic", test.Detection);
        Assert.Equal("xunit", test.Framework);
    }

    [Fact]
    public async Task OfflineOpenRejectsAlteredManifestIdentity()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/C.cs", "class C {}");
        var snapshot = await fixture.Reader.ReadAsync(fixture.Request());
        var path = Path.Combine(snapshot.Directory, "manifest.json");
        File.SetAttributes(path, FileAttributes.Normal);
        await File.WriteAllTextAsync(path, (await File.ReadAllTextAsync(path)).Replace("acme/garage", "acme/other", StringComparison.Ordinal));
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Store.OpenAsync(snapshot.Manifest.SelectionHash));
    }

    [Fact]
    public async Task CancelledExportPreservesPreviouslyPublishedReport()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/C.cs", "class C {}");
        var snapshot = await fixture.Reader.ReadAsync(fixture.Request());
        var project = await new CSharpAnalyzer(fixture.Store).AnalyzeAsync(snapshot);
        var path = await AnalysisReportWriter.WriteAsync(fixture.Workspace, project, CancellationToken.None);
        var before = await File.ReadAllTextAsync(path);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => AnalysisReportWriter.WriteAsync(fixture.Workspace, project, cancellation.Token));
        Assert.Equal(before, await File.ReadAllTextAsync(path));
        Assert.Single(Directory.GetFiles(Path.GetDirectoryName(path)!));
    }

    [Fact]
    public async Task ConditionalSymbolsChooseActiveDeclarations()
    {
        var project = await Analyze(new Dictionary<string, string> { ["App/C.cs"] = "#if FEATURE\nclass Enabled {}\n#else\nclass Disabled {}\n#endif" },
            new AnalysisOptions([new("source", ["**/*.cs"], [], "14", ["FEATURE"], [])]));
        Assert.Equal("Enabled", Assert.Single(project.Compilations[0].Types).Name);
    }

    [Fact]
    public async Task RejectsTamperedBlobs()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/C.cs", "class C {}");
        var snapshot = await fixture.Reader.ReadAsync(fixture.Request());
        var blob = Path.Combine(snapshot.Directory, snapshot.Manifest.Files[0].BlobSha + ".blob");
        File.SetAttributes(blob, FileAttributes.Normal);
        await File.WriteAllTextAsync(blob, "class X {}");
        await Assert.ThrowsAsync<InvalidDataException>(() => new CSharpAnalyzer(fixture.Store).AnalyzeAsync(snapshot));
    }

    [Fact]
    public async Task OfflineOpenVerifiesSnapshotAndExportsDeterministicJson()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/C.cs", "class C { int M() => 1; }");
        var snapshot = await fixture.Reader.ReadAsync(fixture.Request());
        var opened = await fixture.Store.OpenAsync(snapshot.Manifest.SelectionHash);
        var analyzer = new CSharpAnalyzer(fixture.Store);
        var first = await analyzer.AnalyzeAsync(opened);
        var second = await analyzer.AnalyzeAsync(opened);
        Assert.Equal(JsonSerializer.Serialize(first), JsonSerializer.Serialize(second));
        var path = await AnalysisReportWriter.WriteAsync(fixture.Workspace, first, CancellationToken.None);
        using var report = JsonDocument.Parse(await File.ReadAllTextAsync(path));
        Assert.Equal(1, report.RootElement.GetProperty("version").GetInt32());
        Assert.Equal(opened.Manifest.CommitSha, report.RootElement.GetProperty("snapshot").GetProperty("commitSha").GetString());
        Assert.Single(fixture.Client.Downloaded);
    }

    [Fact]
    public async Task HonoursCancellationBeforeAnalysis()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/C.cs", "class C {}");
        var snapshot = await fixture.Reader.ReadAsync(fixture.Request());
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new CSharpAnalyzer(fixture.Store).AnalyzeAsync(snapshot, cancellationToken: cancellation.Token));
    }

    private static Task<AnalysedProject> Analyze(string source) => Analyze(new Dictionary<string, string> { ["App/C.cs"] = source });

    private static async Task<AnalysedProject> Analyze(Dictionary<string, string> files, AnalysisOptions? options = null)
    {
        var fixture = new RepositoryFixture();
        foreach (var (path, source) in files) fixture.Client.Add(path, source);
        var tests = files.Keys.Any(path => path.StartsWith("Tests/", StringComparison.Ordinal)) ? new[] { "Tests/**/*.cs" } : [];
        var snapshot = await fixture.Reader.ReadAsync(fixture.Request(include: ["**/*.cs"], tests: tests));
        return await new CSharpAnalyzer(fixture.Store).AnalyzeAsync(snapshot, options);
    }

    private static Uml.Generator.Analysis.Input.CompilationOptions Group(string id, string[] include, string[]? references = null) =>
        new(id, include, references ?? [], "14", [], []);

    private static AnalysedMethod Method(AnalysedProject project, string name) =>
        project.Compilations.SelectMany(group => group.Types).SelectMany(type => type.Methods).Single(method => method.Name == name);

    private static IEnumerable<CallSite> Calls(AnalysedMethod method) =>
        method.Body == null ? [] : Walk(method.Body.Operations).Where(operation => operation.Call != null).Select(operation => operation.Call!);

    private static IEnumerable<BodyOperation> Walk(IEnumerable<BodyOperation> operations)
    {
        foreach (var operation in operations)
        {
            yield return operation;
            foreach (var child in Walk(operation.Children)) yield return child;
        }
    }
}
