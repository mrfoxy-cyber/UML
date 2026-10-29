# Analysis contracts

`CSharpAnalyzer` coordinates verified snapshot input, explicit in-memory compilation groups, declarations, relationships, structured method bodies and test annotations. Readers return ordinary records; Roslyn syntax/semantic objects never escape into the output model. Analysis contains no diagram layout or inferred ownership.

## Identity and evidence

- Source symbol IDs combine repository, configured compilation ID and Roslyn documentation identity. Overloads and generic arity remain distinct. Referenced compilations use the same IDs as their declarations. External symbols have an assembly-qualified external scope.
- Method fingerprints use SHA-256 over length-delimited token kinds and token text, ignoring comments/formatting. They cover method declarations/signatures and bodies, including partial implementations. Fingerprint version 1 is explicit. Changing a body preserves its method ID but changes its fingerprint; renames/signature changes can change identity.
- Anonymous functions and local scopes without documentation identities use source-position fallback identities. These may change when code moves. No rename/move matching or historical identity migration is claimed.
- Source spans use repository-relative paths, zero-based UTF-16 start/length and one-based start/end line/column. End positions are exclusive. Partial type/method declarations retain multiple source locations. Commit and blob provenance live in the report's snapshot manifest.
- Framework metadata comes from the installed trusted .NET runtime. Its version and the Roslyn version are recorded; this does not reproduce an unprovided original target framework/build configuration.

## Relationships and bodies

- Inheritance/interface declarations and member/parameter/return type uses are supported. A field reference does not establish UML aggregation or composition; extractors must not infer ownership automatically.
- Bodies preserve lexical structure for branches, loops, switch arms, exception handling, returns, awaits, short-circuit operations and explicit calls. Labels capture relevant expressions; source spans retain evidence. Member field/property initializers are separate bodies attributed to the member.
- Calls include explicit invocations, explicit/target-typed construction and constructor initializers. A resolved target is the compiler-selected declaration. Virtual/interface/delegate dispatch does not identify the runtime implementation. Ambiguous/unresolved calls retain candidates or source text with a null target; UML003 diagnostics make them visible. `nameof` is compile-time syntax and produces no runtime call.
- Deferred lambdas/local functions retain separate `scopeId` boundaries and caller IDs. Their lexical presence does not imply invocation. Children retain lexical order, which is not guaranteed execution order (for example, nested argument calls).
- These records are not an execution trace, test coverage, or a full control-flow graph. Reflection, runtime dispatch, implicit property/operator/enumerator calls and compiler-generated behaviour are not expanded. Primary-constructor base argument execution is not reconstructed. Implicit/generated methods without explicit source declarations are not listed as declarations; a resolved call can refer to one.
- Traversal is limited to 96 syntax levels. Omitted subtrees receive a `DepthLimit` operation and UML002 warning, rather than appearing complete.

## Tests and comment annotations

Only snapshot files selected as tests are searched for supported test entry attributes: xUnit Fact/Theory, NUnit Test/TestCase/TestCaseSource, and MSTest TestMethod/DataTestMethod. Framework namespaces are checked when symbols resolve. A known attribute name with missing dependencies is marked `syntax-unresolved`; it is a test candidate, not semantic proof. Custom inherited test attributes are not discovered.

Leading ordinary comments on a test method may contain:

```csharp
// [uml: sequence id: parking title: Parking a vehicle]
// [uml: usecase id: UC-PARK]
[Fact]
public void Parks_vehicle() { /* ... */ }
```

Types include class, object, component, package, deployment, composite-structure, profile, aggregation, usecase, sequence, communication, activity, state, timing and interaction-overview. `id` and `title` are optional; values terminate at the next ` id:`/` title:` marker or closing bracket. Duplicate/empty fields, unknown types and missing closing brackets produce UML001 warnings. XML documentation annotations and attributes defined in production code are not required. Annotation text expresses diagram intent, not evidence that a test executed a particular path.

## Extension boundaries

Keep package/reference acquisition in a separately approved, metadata-only input mechanism. Keep diagram selection, test reachability, grouping and layout in extraction/output. The current analysis report intentionally exposes missing dependencies instead of silently restoring them or substituting fake framework symbols.
