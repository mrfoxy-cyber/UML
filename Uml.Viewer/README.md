# UML Studio — JSON Viewer

A standalone, offline viewer for human-editable UML JSON. Dedicated class, aggregation, component, sequence, communication and activity renderers share a drawing core and theme.

## Open the viewer

Open [index.html](index.html) in a modern browser. No install, server, account or network connection is required. Keep `src/`, `themes/`, `vendor/` and `examples/` alongside it.

Choose an example, use **Open JSON**, or drop one `.json` file onto the page. Edit externally, then open/drop again. The viewer does not overwrite files. **JSON source** shows the exact imported text; **↓ JSON** downloads a copy.

Diagrams are grouped by UML type in the sidebar. Open **Sequence diagrams**, **Activity diagrams**, or another type to choose a diagram. Each entry shows its JSON `title` and unique `id`; **Viewing** marks the active diagram. Its type, title and ID also appear above the canvas. Multiple parking/removal flows can therefore share a type without becoming ambiguous.

Optional connected tests are visible through **↗**, member/connection inspection, and the toolbar's **Tests** button. Use `tests: null` for an unlinked object or flow. The shared catalogue stores names, files, symbols and optional HTTPS links; these references do not run tests or indicate pass/fail. See [Connected tests](CONNECTED-VIEWS.md#connected-tests).

Choose **Garage · connected views** to try shared identity. Expand Garage service and click a method, or use a card's **↗** button. **Also appears in** groups results by diagram; additional calls to the same method stay available under “more appearances.” Jumps reveal collapsed groups/alternative frames and highlight matches. **← Back** restores the previous view, detail state, zoom and selection.

Use **Open project** and choose `diagrams/garage-project` to load a shared catalogue and separate parking/removal files through `uml.project.json`. Source mode offers each original file and a combined document; downloading the combined document produces a standalone JSON that can be opened normally. Edit the files outside the viewer and reopen the folder to refresh.

Click a card/group header to change detail state. JSON can define different collapsed/expanded names and visible fields. Search focuses an element; drag pans, scroll zooms and **Fit view** frames the diagram. Keyboard users can tab to cards/controls; on the canvas, arrows pan, `+`/`−` zoom and `0`/`F` fit.

- [JSON format and named collapse states](JSON-FORMAT.md)
- [Connected views, shared IDs and project manifests](CONNECTED-VIEWS.md)
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
- [Garage connected views](examples/garage-connected.uml.json): seven views of one model, parking and removal operations, repeated calls and activity references.
- [Garage parking](examples/garage-parking-linked.uml.json) and [Garage removal](examples/garage-removal-linked.uml.json): smaller standalone examples with four views each.
- [Garage project manifest](diagrams/garage-project/uml.project.json): the same shared model split into readable source files.

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

Implemented: six renderers, stable shared/member IDs, cross-view references and navigation with Back, project-folder manifests, typed relationships, flat groups, named collapse states, nested guarded alternatives, validation, search, pan/zoom, fullscreen, light/dark themes, JSON download, safe text rendering and preservation of the last good import.

The separate generator, other UML types, nested structural groups, file watching, in-app editing and SVG/PlantUML export remain later work. A folder can organize accepted documents; the browser reads a file when selected or dropped.
