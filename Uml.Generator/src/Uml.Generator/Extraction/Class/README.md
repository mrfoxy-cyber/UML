# Class diagram extraction

`ClassDiagramExtractor` accepts an `AnalysedProject` and a class diagram definition. It uses no filesystem, network, Roslyn compilation, source parsing or code execution. Analysis owns source understanding; extraction owns selection and diagram semantics; output owns viewer format and publication.

## Configuration

Each entry under `diagrams` requires `id`, `type: "class"` and `title`. Optional `class` settings:

```json
{
  "compilations": ["garage", "vehicle"],
  "include": ["Garage/Models/**/*.cs"],
  "exclude": [],
  "members": {
    "visibility": ["public", "protected"],
    "fields": false,
    "properties": true,
    "constructors": true,
    "methods": true,
    "accessors": false
  },
  "relationships": ["inheritance", "implementation", "member-type"],
  "context": { "depth": 1, "includeExternal": false },
  "groupBy": "namespace"
}
```

Omitted settings use these defaults, except `compilations` defaults to all analysed groups and `include` defaults to `**/*.cs`. Paths are case-sensitive repository-relative globs against analysis source locations. They never read files. Partial types appear once; any matching declaration selects a type, while any excluded declaration removes the entire type, including from context. Unknown compilations, invalid options and empty supported selections fail explicitly. Unsupported selected kinds such as delegates produce diagnostics.

Classes, interfaces and enums are supported. Records retain a C# record note. Structs use a class card with an explicit C# struct note because the viewer has no struct element kind. Enum values are attributes even when ordinary fields are hidden. Overloaded methods have separate identities. Accessors are hidden by default while the property remains visible. `properties` also selects events. Visibility filters are independent of which relationships are analysed: a hidden private field can still supply an association.

## Relationship rules

| Setting | Source fact | Output |
| --- | --- | --- |
| `inheritance` | Explicit class/interface base type | Derived → parent, `inheritance` |
| `implementation` | Class implements interface | Class → interface, `implementation` |
| `member-type` | Field/property/event type | Owner → referenced type, `association` |
| `parameter-type` | Method parameter type | Owner → referenced type, `dependency` |
| `returns` | Method return type | Owner → referenced type, `dependency` |
| `generic-constraint` | Type/method generic constraint | Owner → constraint type, `dependency` |
| `call` | Resolved explicit call/constructor declaring type | Caller type → target type, `dependency` |

The last four settings are opt-in. All settings inspect analysed facts irrespective of visible member filters. Collection/generic arguments and array element types are traversed so `List<Vehicle>` can establish usage of `Vehicle`. A generic base's type argument is a usage dependency, never another parent. Ordinary primitive/framework scalar references and self-connections are omitted. Multiplicity, aggregation and composition are never inferred.

Repeated facts with the same output kind and endpoints share one relationship while keeping all source evidence in provenance. Unresolved targets are omitted with diagnostics. Resolved interface/virtual calls describe declared types, not runtime implementations. External targets are omitted unless `includeExternal` is enabled; supported external metadata types become context cards with no members or snapshot source claims.

Context follows outgoing enabled relationships for 0–5 hops. It remains within configured compilations, except explicitly enabled external metadata. Context classes have no exported members and use the viewer's `contextElements` field to appear faded. Source exclusions apply to context as well as focus. Edges are exported only when both endpoints are selected; omissions caused by depth or missing/excluded targets appear in provenance. Context membership does not imply test coverage or execution.

## Output and identity

`ViewerIdMapper` hashes the complete analysis identity with a separate category prefix. Type/member identities do not depend on the diagram name or source order, and overloads remain distinct. Relationship IDs depend on output kind and endpoints; added evidence does not change the relationship ID. Namespace or compilation grouping is flat, with no ownership meaning. `groupBy: "none"` omits groups. Cards start collapsed; groups start expanded. Styling stays in the viewer.

The generator validates the class-only viewer subset by construction and through output guards. Oversized diagrams fail rather than being truncated: 150 elements, 600 identified members total, 200 members per element, 600 relationships, 50 groups, text/ID limits and 4 MB JSON. Endpoints, duplicate identities, inheritance cycles and implementation directions are checked. `scripts/check-class-export.cjs` additionally runs the actual neighbouring viewer contract and both collapsed/expanded renderer layouts.

Provenance is separate because the viewer rejects unknown document fields. The raw JSON records snapshot provenance, options, symbol/ID mappings, selected source locations, method fingerprints, relationship evidence and diagnostics. The accompanying `provenance.html` presents the same evidence as a passive readable report, with escaped content, no scripts and source links pinned to the exact GitHub commit. Open HTML from File Explorer in a regular browser, or inspect raw JSON in an editor; these are not viewer diagram files. Abstract source classes are labelled `(abstract)` in both card display states, while their semantic names and IDs stay unchanged. No test links are inferred from static class dependencies. Future interaction/activity extractors should reuse the same ID mapper.
