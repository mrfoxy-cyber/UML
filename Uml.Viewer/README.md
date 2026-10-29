# UML Studio — JSON Viewer

A standalone, offline viewer for human-editable UML JSON. Dedicated class, aggregation, component, sequence and communication renderers share a drawing core and theme.

## Open the viewer

Open [index.html](index.html) in a modern browser. No install, server, account or network connection is required. Keep `src/`, `themes/`, `vendor/` and `examples/` alongside it.

Choose an example, use **Open JSON**, or drop one `.json` file onto the page. Edit externally, then open/drop again. The viewer does not overwrite files. **JSON source** shows the exact imported text; **↓ JSON** downloads a copy.

Click a card/group header to change detail state. JSON can define different collapsed/expanded names and visible fields. Search focuses an element; drag pans, scroll zooms and **Fit view** frames the diagram. Keyboard users can tab to cards/controls; on the canvas, arrows pan, `+`/`−` zoom and `0`/`F` fit.

- [JSON format and named collapse states](JSON-FORMAT.md)
- [Published JSON Schema](schema/uml-document.schema.json)
- [Diagram types](DIAGRAM-TYPES.md)
- [Project plan](PROJECT-PLAN.md)
- [Rendering architecture](RENDERING-ARCHITECTURE.md)

## Examples

- [Bicycle aggregation](examples/bicycle-aggregation.uml.json): whole/parts and renamed expanded details.
- [Garage structure](examples/garage-structure.uml.json): named cards and a collapsible group.
- [Components](examples/components.uml.json): connections crossing collapsed groups.
- [Parking success](examples/parking-success.uml.json): one interaction, two views.
- [Parking alternatives](examples/parking-alternatives.uml.json): named alternative frame and guards.

These teaching examples do not claim to capture an application's complete implementation.

## Development

Node 22+ is used for development only:

```text
node scripts/build.cjs
pnpm install --frozen-lockfile
node --test tests/*.test.cjs
```

Build publishes the schema and a local example payload from the readable JSON files. Rebuild after changing the contract or examples. The page loads scripts directly, so it works from `file://`; documents enter through explicit file selection/drop.

An optional localhost-only preview runs with `node scripts/serve.cjs` at `http://127.0.0.1:4173`. Normal use needs no server.

The development-only DOM test library is pinned in `package.json`/`pnpm-lock.yaml`. ELK is bundled with its [license and provenance](vendor/README.md). Imported diagrams are not sent to a service.

## Scope

Implemented: five renderers, typed relationships, flat groups, named collapse states, nested guarded alternatives, validation, search, pan/zoom, fullscreen, light/dark themes, JSON download, safe text rendering and preservation of the last good import.

The separate generator, other UML types, nested structural groups, file watching, in-app editing and SVG/PlantUML export remain later work. A folder can organize accepted documents; the browser reads a file when selected or dropped.
