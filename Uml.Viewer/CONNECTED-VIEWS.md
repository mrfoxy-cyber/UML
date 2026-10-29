# Connected views and project files

Keep stable IDs when changing names. The viewer follows explicit references; it does not guess identity from matching text or infer a method call from its label.

## Shared objects and occurrences

Element IDs and identified member IDs share one document-wide namespace. Define a member once on its owning class, interface or enum:

```json
{
  "garage": {
    "kind": "class",
    "name": "Garage",
    "members": [
      "Capacity: int",
      { "id": "garage.park", "kind": "operation", "name": "+ Park(vehicle)" },
      { "id": "garage.remove", "kind": "operation", "name": "+ Remove(registrationNumber)" }
    ]
  }
}
```

This is an `elements` excerpt. Identified members require `id`, `kind` (`operation` or `attribute`) and `name`; `notes` is optional. The enclosing element is the owner. Existing string members remain supported, but strings do not have individual cross-view identity.

A message references the operation independently of its own occurrence ID:

```json
{
  "id": "park-first-vehicle",
  "kind": "call",
  "from": "service",
  "to": "garage",
  "label": "Park(vehicle)",
  "references": ["garage.park"]
}
```

Another message can reference `garage.park` with a different local ID. Message IDs are unique within their interaction; activity node IDs are unique within their activity. View ID + occurrence kind + local ID identifies an occurrence. The same `request` step ID in parking and removal therefore causes no collision.

`references` arrays can appear on elements, call/reply messages and activity nodes. Each reference must name an existing element or identified member. Multiple references are allowed. Element references can connect a component representation to model classes. Message endpoints continue to reference participant elements; a reference does not silently change who sends or receives the message.

## Activity definitions

```json
{
  "activities": {
    "parking": {
      "nodes": [
        { "id": "start", "kind": "initial", "name": "Start" },
        { "id": "park", "kind": "action", "name": "Park the vehicle", "references": ["garage.park"] },
        { "id": "finish", "kind": "final", "name": "Finish" }
      ],
      "flows": [
        { "id": "begin", "from": "start", "to": "park" },
        { "id": "end", "from": "park", "to": "finish" }
      ]
    }
  },
  "views": [
    { "id": "parking-flow", "type": "activity", "title": "Parking workflow", "activity": "parking" }
  ]
}
```

This excerpt needs the normal document fields and shared `elements`. Supported node kinds: `initial`, `final`, `action`, `decision`, `merge`. Nodes require `id`, `kind`, `name`; optional `notes`, `references` and `display`. Activity display fields are `name`, `kind`, `notes`. Initial/final nodes have marker symbols; decisions/merges use diamonds; actions use rounded cards. Non-action symbols stay compact; their notes/references are available through inspection.

Flows require `id`, `from`, `to`, with an optional `guard`. Every outgoing decision flow needs a guard. Endpoints must exist in that activity. Final nodes cannot have outgoing flows; initial nodes cannot have incoming flows. Validation checks these structural rules, but cannot establish that a workflow correctly describes business behavior. Fork/join, swimlanes, object flows and token execution are outside this activity renderer's current scope.

## Navigation

Use a card's **↗** button or click an identified member. Message inspection and activity inspection expose their references. **Also appears in** groups direct matches by view. Additional occurrences remain under “more appearances”; owner/member matches are shown separately as related.

Jumps reveal the target's group, member compartment or alternative frame, centre it and highlight the shared object's matches in that view. Reveal overrides live only in viewer state, so even a normally hidden member/step can be inspected. Reset restores JSON display defaults. **Back** restores the previous view, camera, expansion/reveal state and shared selection. Loading another document clears history and rebuilds the lookup. Source JSON is never rewritten.

## Multiple files

Choose **Open project**, then select a folder containing exactly one `uml.project.json`:

```json
{
  "version": 1,
  "kind": "uml-project",
  "id": "garage-project",
  "title": "Garage connected diagrams",
  "model": "model.json",
  "diagrams": ["model-view.json", "parking.json", "removal.json"]
}
```

- `model.json` contains `elements` and optional `groups` and `relationships`.
- Each diagram file contains a nonempty `views` array and optional `interactions` and `activities`.
- All diagram files reference the same model IDs. Define each interaction/activity once. Duplicate view IDs and conflicting definitions fail import.
- Paths are relative to the manifest. Parent traversal, absolute paths and URLs are rejected. Files are read only from the user-selected folder; no network fetching occurs.
- Up to 64 JSON files can be selected, 4 MB per file, 12 MB total. The assembled document must also meet the normal 4 MB document limit and all combined count limits.
- File order determines view order. Unlisted JSON files are not incorporated into the model. A missing source file or invalid reference preserves the last good project.

Source mode offers each original source file, preserving its exact text, plus an assembled document. **↓ JSON** downloads the selected source in source mode; otherwise it downloads the combined document, which works as an ordinary standalone import. Reopen the folder after editing; there is no file watcher.

See [the project manifest schema](schema/uml-project.schema.json) and the working folder [diagrams/garage-project](diagrams/garage-project).

## Garage examples and scope

The [combined example](examples/garage-connected.uml.json) provides seven views: one class diagram plus sequence, communication and activity views for parking and removal. [Parking](examples/garage-parking-linked.uml.json) and [removal](examples/garage-removal-linked.uml.json) are smaller self-contained documents. The project folder splits the same catalogue and scenarios across files for editing.

Names and method relationships were reviewed against `Garage-v2/Garage/Services/GarageService.cs`, `Garage/Models/Garage.cs` and `Garage/Models/ParkingSpot.cs`. These are manually reviewed teaching examples, with condensed validation and outcome paths. They omit collection queries, exception handling and some detailed checks; they are not generated exhaustive code traces. The generator remains a separate future project.
