# Editable UML JSON — version 1

Open `index.html` and drop a `.json` file onto the viewer, or use **Open JSON**. Edit your file externally and open/drop it again. The viewer does not overwrite it. **JSON source** shows the exact imported text; **↓ JSON** downloads a copy.

The [JSON Schema](schema/uml-document.schema.json) is generated from the same contract used for runtime validation. An optional `$schema` field can point your editor to it; the viewer does not fetch that URL.

## Document and views

Required fields are `version: 1`, `id`, `title`, `elements` and non-empty `views`. Optional sections are `groups`, `relationships` and `interactions`. IDs begin with a letter, followed by letters, digits, periods, underscores or hyphens. Unknown fields, duplicate JSON properties and unresolved references fail with an error location.

Every view has a unique `id`, `title` and `type`. Class, aggregation and component views select an `elements` array. Sequence and communication views reference an `interaction` ID. Other diagram types are recognized but unsupported in this release. A failed import keeps the last valid document visible.

## Elements and relationships

Elements are keyed by readable IDs. Each has `kind` and `name`, with optional `members` (strings), `notes` (string) and `display`. Implemented kinds: `class`, `interface`, `enum`, `component`, `actor`.

Class/aggregation views select classes, interfaces and enums; component views select components. Interaction participants reference declared elements.

Relationships require `id`, `kind`, `from`, `to`. Optional fields: `label`, `fromMultiplicity`, `toMultiplicity`.

| Kind | Direction and notation |
| --- | --- |
| `dependency` | Source depends on target; dashed arrow. |
| `association` | Plain connection, with no implied ownership. |
| `inheritance` | Derived class/interface to parent; hollow triangle at `to`. |
| `implementation` | Class to interface; dashed line, hollow triangle at `to`. |
| `aggregation` | Whole to part; hollow diamond at `from`. |
| `composition` | Composite owner to part; filled diamond at `from`. |

Aggregation views select aggregation relationships. Class/component views retain explicit relationship kinds. Invalid inheritance cycles and implementation endpoints are rejected.

## Name and control each collapse state

Place a definition like this under an ID in `elements`:

```json
{
  "kind": "class",
  "name": "GarageService",
  "members": ["+ Park(vehicle, garage)", "+ CreateGarage(name, capacity)"],
  "notes": "Coordinates garage operations.",
  "display": {
    "initial": "collapsed",
    "collapsed": {
      "name": "Garage service",
      "show": ["name", "count"]
    },
    "expanded": {
      "name": "GarageService — operations",
      "show": ["name", "kind", "members", "notes"]
    }
  }
}
```

- `initial`: `collapsed` or `expanded`. Elements default to collapsed.
- A state's `name` is its displayed title. The semantic name and ID remain unchanged.
- A state's `show` controls the visible fields: `name`, `kind`, `members`, `notes`, `count`.
- Defaults: collapsed shows name, kind and count; expanded shows name, kind, members and notes.
- `collapsible: false` inside `display` disables toggling and retains the initial state.
- Reset restores the JSON defaults. Different views retain their own expansion and camera state during the session.

Styling stays in the theme. These options control information presentation rather than colors or coordinates.

## Named groups

Groups require `id`, `name`, `members` (element IDs). Optional fields: `notes`, `display`. Groups are flat and an element belongs to at most one group.

```json
{
  "id": "domain",
  "name": "Garage domain",
  "members": ["service", "garage", "spot"],
  "display": {
    "initial": "expanded",
    "collapsed": { "name": "Domain overview", "show": ["name", "count"] },
    "expanded": { "name": "Garage domain", "show": ["name", "members"] }
  }
}
```

Group `show` fields are `name`, `count`, `members`, `notes`. Groups default to expanded. Showing members while expanded reveals their elements. Collapsed groups become summary cards; internal connections are hidden, while external connections retain original endpoints in the connection details. Several connections can share one summary link. Group borders do not establish UML ownership.

Structural and communication views support group collapse. Sequence keeps individual lifelines and supports collapse of participant details and alternative frames.

## Shared interactions

Interactions are keyed by ID. Each requires `participants` and ordered `steps`. Optional `story` and `scenario` fields are descriptive IDs and do not require an external catalogue.

Messages have `id`, `kind` (`call` or `reply`), `from`, `to`, `label`. Both endpoints must be participants. Labels are text, never executed code. Sequence and communication views reference the same interaction, so editing a call affects both.

An alternative has `id`, `kind: "alt"`, optional `name`/`display`, and two or more `branches`. Each branch has `guard` text and ordered `steps`. For example, inside an interaction with declared `service` and `user` participants:

```json
{
  "id": "outcome",
  "kind": "alt",
  "name": "Parking outcome",
  "display": {
    "collapsed": { "name": "Outcome", "show": ["name", "count"] },
    "expanded": { "name": "Parking alternatives", "show": ["name", "steps"] }
  },
  "branches": [
    { "guard": "Space available", "steps": [
      { "id": "success", "kind": "reply", "from": "service", "to": "user", "label": "Parked" }
    ] },
    { "guard": "Garage full", "steps": [
      { "id": "failure", "kind": "reply", "from": "service", "to": "user", "label": "No capacity" }
    ] }
  ]
}
```

Alternative `show` fields: `name`, `count`, `steps`, `guards`. Frames default to collapsed. Nesting is supported up to six levels. Step IDs must be unique across the whole interaction. Communication retains every message and its guard context even when a sequence frame is folded. Numbering describes positions in the source/branch tree, not a recorded execution. Select a connection to inspect messages; **View in sequence** opens their original context.

## Limits and implemented scope

Maximums: 4 MB input, 150 elements, 600 relationships, 50 groups, 12 interactions, 24 participants per interaction, 600 total interaction steps and 30 views. Text lengths are bounded in the schema.

The viewer reads one document at a time. Nested structural groups, loop/parallel fragments, async scheduling, ports, other UML types, in-app JSON editing, file watching and SVG/PlantUML export remain later work. Unsupported constructs fail explicitly.
