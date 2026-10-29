using System.Text.Json;
using Uml.Generator.Analysis;
using Uml.Generator.Analysis.Input;
using Uml.Generator.Extraction.Class;
using Uml.Generator.Extraction.Models;
using Uml.Generator.Output;
using Uml.Generator.Tests.Repository;
using Xunit;

namespace Uml.Generator.Tests.Extraction;

public sealed class ClassDiagramExtractorTests
{
    [Fact]
    public async Task PartialTypesMergeAndExclusionWinsOnAnyDeclaration()
    {
        var project = await Analyze(new Dictionary<string, string>
        {
            ["App/A.cs"] = "public partial class C { public void A() {} }",
            ["App/B.cs"] = "public partial class C { public void B() {} }",
            ["App/D.cs"] = "public class D {}"
        });
        var selected = Extract(project, new() { Include = ["App/A.cs"] });
        Assert.Equal(2, Assert.Single(selected.Classes).Members.Count);
        Assert.Equal(2, selected.Classes[0].Sources.Count);
        var excluded = Extract(project, new() { Exclude = ["App/B.cs"] });
        Assert.Equal("D", Assert.Single(excluded.Classes).Name);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(1, 2)]
    [InlineData(2, 3)]
    public async Task ContextUsesBoundedOutgoingRelationships(int depth, int count)
    {
        var project = await Analyze(new Dictionary<string, string>
        {
            ["App/A.cs"] = "public class A { public B Value { get; set; } }",
            ["App/B.cs"] = "public class B { public C Value { get; set; } }",
            ["App/C.cs"] = "public class C {}",
            ["App/Caller.cs"] = "public class Caller { public A Value { get; set; } }"
        });
        var diagram = Extract(project, new() { Include = ["App/A.cs"], Context = new(depth) });
        Assert.Equal(count, diagram.Classes.Count);
        Assert.Equal(count - 1, diagram.Classes.Count(type => type.IsContext));
        Assert.DoesNotContain(diagram.Classes, type => type.Name == "Caller");
        Assert.All(diagram.Classes.Where(type => type.IsContext), type => Assert.Empty(type.Members));
        var document = new ViewerDocumentBuilder().Build(diagram).Document;
        Assert.Equal(count - 1, document.Views[0].ContextElements.Count);
        Assert.All(document.Relationships, edge => { Assert.True(document.Elements.ContainsKey(edge.From)); Assert.True(document.Elements.ContainsKey(edge.To)); });
    }

    [Fact]
    public async Task PreservesInheritanceAndImplementationDirections()
    {
        var diagram = Extract(await Analyze("public interface I {} public class Base {} public class Derived : Base, I {}"));
        var derived = diagram.Classes.Single(type => type.Name == "Derived").SymbolId;
        Assert.Contains(diagram.Relationships, edge => edge.FromId == derived && edge.Kind == "inheritance" && edge.ToId == diagram.Classes.Single(type => type.Name == "Base").SymbolId);
        Assert.Contains(diagram.Relationships, edge => edge.FromId == derived && edge.Kind == "implementation" && edge.ToId == diagram.Classes.Single(type => type.Name == "I").SymbolId);
    }

    [Fact]
    public async Task FiltersMemberVisibilityAndHidesAccessorsWithoutLosingOverloads()
    {
        var project = await Analyze("public class C { public int Value {get;set;} public int Field; private void Secret() {} protected void Guard() {} public void M(int x) {} public void M(string s) {} }");
        var diagram = Extract(project);
        var members = Assert.Single(diagram.Classes).Members;
        Assert.Contains(members, member => member.Name.StartsWith("+ Value:", StringComparison.Ordinal));
        Assert.Contains(members, member => member.Name.StartsWith("# Guard(", StringComparison.Ordinal));
        Assert.Equal(2, members.Count(member => member.Name.StartsWith("+ M(", StringComparison.Ordinal)));
        Assert.DoesNotContain(members, member => member.Name.Contains("Secret") || member.Name.Contains("get_Value") || member.Name.Contains("Field"));
        var detailed = Extract(project, new() { Members = new() { Visibility = ["private", "public"], Fields = true, Accessors = true } });
        Assert.Contains(detailed.Classes[0].Members, member => member.Name.Contains("Secret"));
        Assert.Contains(detailed.Classes[0].Members, member => member.Name.Contains("get_Value"));
        Assert.Contains(detailed.Classes[0].Members, member => member.Name.Contains("Field"));
    }

    [Fact]
    public async Task CollectionArgumentsBecomeUsageWithoutInventingMultiplicityOrOwnership()
    {
        var diagram = Extract(await Analyze("public class Vehicle {} public class Garage { public System.Collections.Generic.List<Vehicle> Vehicles {get;set;} }") );
        var edge = Assert.Single(diagram.Relationships);
        Assert.Equal("association", edge.Kind);
        Assert.Equal(diagram.Classes.Single(type => type.Name == "Vehicle").SymbolId, edge.ToId);
        Assert.Contains(diagram.Classes.Single(type => type.Name == "Garage").Members, member => member.Name.Contains("List<Vehicle>"));
        var text = JsonSerializer.Serialize(new ViewerDocumentBuilder().Build(diagram).Document);
        Assert.DoesNotContain("Multiplicity", text);
        Assert.DoesNotContain("composition", text);
        Assert.DoesNotContain("aggregation", text);
    }

    [Fact]
    public async Task DuplicateReferencesShareOneEdgeAndKeepAllEvidence()
    {
        var diagram = Extract(await Analyze("public class B {} public class A { B first; B second; }"));
        var edge = Assert.Single(diagram.Relationships);
        Assert.Equal(2, edge.Evidence.Count);
        Assert.NotEqual(edge.Evidence[0].SymbolId, edge.Evidence[1].SymbolId);
    }

    [Fact]
    public async Task SignatureAndCallDependenciesAreOptIn()
    {
        var project = await Analyze("public class B { public void Park() {} } public class A { public B Run(B b) { b.Park(); return b; } }");
        Assert.Empty(Extract(project).Relationships);
        var signatures = Extract(project, new() { Relationships = ["returns", "parameter-type"] });
        Assert.Equal("dependency", Assert.Single(signatures.Relationships).Kind);
        Assert.Equal(2, signatures.Relationships[0].Evidence.Count);
        var calls = Extract(project, new() { Relationships = ["call"] });
        Assert.Equal("call", Assert.Single(calls.Relationships).Evidence[0].Kind);
    }

    [Fact]
    public async Task ConstructorCallsAndGenericConstraintsHaveTypeTargets()
    {
        var project = await Analyze("public class B {} public class A<T> where T : B { public B Make() => new B(); }");
        var diagram = Extract(project, new() { Relationships = ["call", "generic-constraint"] });
        var edge = Assert.Single(diagram.Relationships);
        Assert.Contains(edge.Evidence, evidence => evidence.Kind == "call");
        Assert.Contains(edge.Evidence, evidence => evidence.Kind == "generic-constraint");
    }

    [Fact]
    public async Task ExternalMetadataIsOptionalContextWithCorrectInterfaceKind()
    {
        var project = await Analyze("public class C : System.IDisposable { public void Dispose() {} }");
        Assert.Single(Extract(project).Classes);
        var diagram = Extract(project, new() { Context = new(1, true) });
        var external = Assert.Single(diagram.Classes, type => type.IsExternal);
        Assert.True(external.IsContext);
        Assert.Equal("interface", external.Kind);
        Assert.Equal("IDisposable", external.Name);
        new ViewerDocumentBuilder().Build(diagram);
    }

    [Fact]
    public async Task KeepsIdsStableAcrossDiagramsAndBodyEdits()
    {
        var first = new ViewerDocumentBuilder().Build(Extract(await Analyze("public class C { public int M() => 1; }")));
        var second = new ViewerDocumentBuilder().Build(Extract(await Analyze("public class C { public int M() => 2; }"), id: "another-view"));
        Assert.Equal(first.Document.Elements.Keys, second.Document.Elements.Keys);
        Assert.Equal(first.Document.Elements.Values.Single().Members[0].Id, second.Document.Elements.Values.Single().Members[0].Id);
        var mapper = new ViewerIdMapper();
        Assert.Matches("^[A-Za-z][A-Za-z0-9._-]{0,119}$", mapper.Map("member", "repo|M:C.M(System.Int32)"));
        Assert.NotEqual(mapper.Map("member", "A.B"), mapper.Map("member", "A-B"));
    }

    [Theory]
    [InlineData("compilation")]
    [InlineData("namespace")]
    [InlineData("none")]
    public async Task BuildsFlatGroupsAndCollapsedCards(string grouping)
    {
        var document = new ViewerDocumentBuilder().Build(Extract(await Analyze("namespace Domain; public class C {}"), new() { GroupBy = grouping })).Document;
        Assert.Equal(grouping == "none" ? 0 : 1, document.Groups.Count);
        Assert.All(document.Elements.Values, element => Assert.Equal("collapsed", element.Display.Initial));
        Assert.All(document.Groups, group => Assert.Equal("expanded", group.Display.Initial));
    }

    [Fact]
    public async Task OversizedDiagramFailsWithoutTruncation()
    {
        var diagram = Extract(await Analyze("public class C {}"));
        var type = diagram.Classes[0];
        var oversized = diagram with { Classes = Enumerable.Range(0, 151).Select(number => type with { SymbolId = "type" + number }).ToArray() };
        Assert.Contains("150", Assert.Throws<InvalidDataException>(() => new ViewerDocumentBuilder().Build(oversized)).Message);
        var member = new ExtractedMember("member", "operation", "+ M()", null, []);
        var tooManyMembers = diagram with { Classes = [type with { Members = Enumerable.Range(0, 201).Select(number => member with { SymbolId = "member" + number }).ToArray() }] };
        Assert.Contains("200", Assert.Throws<InvalidDataException>(() => new ViewerDocumentBuilder().Build(tooManyMembers)).Message);
    }

    [Fact]
    public async Task InheritanceCyclesAreRejectedBeforeExport()
    {
        var diagram = Extract(await Analyze("public class A {} public class B {}"));
        var a = diagram.Classes[0].SymbolId;
        var b = diagram.Classes[1].SymbolId;
        var cyclic = diagram with { Relationships = [new("a-b", "inheritance", a, b, []), new("b-a", "inheritance", b, a, [])] };
        Assert.Contains("cycle", Assert.Throws<InvalidDataException>(() => new ViewerDocumentBuilder().Build(cyclic)).Message);
    }

    [Fact]
    public async Task UnresolvedTypesRemainDiagnosticsWithoutFakeClasses()
    {
        var diagram = Extract(await Analyze("public class C { public Missing Value {get;set;} }") );
        Assert.Single(diagram.Classes);
        Assert.Empty(diagram.Relationships);
        Assert.Contains(diagram.Diagnostics, diagnostic => diagnostic.Code == "CLASS_UNRESOLVED_TYPE");
        Assert.Contains(diagram.Diagnostics, diagnostic => diagnostic.Code == "CLASS_PARTIAL_ANALYSIS");
    }

    [Fact]
    public async Task UnknownCompilationAndOwnershipOptionsFailClearly()
    {
        var project = await Analyze("public class C {}");
        Assert.Throws<InvalidDataException>(() => Extract(project, new() { Compilations = ["missing"] }));
        Assert.Throws<InvalidDataException>(() => Extract(project, new() { Relationships = ["composition"] }));
        Assert.Throws<InvalidDataException>(() => Extract(project, new() { Context = new(6) }));
    }

    [Fact]
    public async Task PublishesViewerJsonAndSeparateProvenanceAndReusesIdenticalExport()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/C.cs", "public class B {} public class C { public B Value {get;set;} }");
        var snapshot = await fixture.Reader.ReadAsync(fixture.Request());
        var diagram = Extract(await new CSharpAnalyzer(fixture.Store).AnalyzeAsync(snapshot));
        var writer = new ViewerJsonWriter();
        var first = await writer.WriteAsync(fixture.Workspace, diagram);
        var second = await writer.WriteAsync(fixture.Workspace, diagram);
        Assert.Equal(first, second);
        using var json = JsonDocument.Parse(await File.ReadAllTextAsync(first.Diagram));
        Assert.False(json.RootElement.TryGetProperty("snapshot", out _));
        using var provenance = JsonDocument.Parse(await File.ReadAllTextAsync(first.Provenance));
        Assert.Equal(snapshot.Manifest.CommitSha, provenance.RootElement.GetProperty("snapshot").GetProperty("commitSha").GetString());
        Assert.NotEmpty(provenance.RootElement.GetProperty("identities").EnumerateObject());
        Assert.Equal(3, Directory.GetFiles(first.Directory).Length);
    }

    [Fact]
    public async Task CancellationNeverPublishesHalfAnExport()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/C.cs", "public class C {}");
        var snapshot = await fixture.Reader.ReadAsync(fixture.Request());
        var diagram = Extract(await new CSharpAnalyzer(fixture.Store).AnalyzeAsync(snapshot));
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => new ViewerJsonWriter().WriteAsync(fixture.Workspace, diagram, cancellation.Token));
        Assert.Empty(Directory.GetFiles(Path.Combine(fixture.Workspace, "output"), "*.json", SearchOption.AllDirectories));
    }

    private static ExtractedClassDiagram Extract(Uml.Generator.Analysis.Models.AnalysedProject project, ClassDiagramOptions? options = null, string id = "classes") =>
        new ClassDiagramExtractor().Extract(project, new ClassDiagramDefinition(id, "class", "Classes", options));

    private static Task<Uml.Generator.Analysis.Models.AnalysedProject> Analyze(string source) => Analyze(new Dictionary<string, string> { ["App/C.cs"] = source });

    private static async Task<Uml.Generator.Analysis.Models.AnalysedProject> Analyze(Dictionary<string, string> sources)
    {
        var fixture = new RepositoryFixture();
        foreach (var (path, text) in sources) fixture.Client.Add(path, text);
        var snapshot = await fixture.Reader.ReadAsync(fixture.Request());
        return await new CSharpAnalyzer(fixture.Store).AnalyzeAsync(snapshot);
    }
}
