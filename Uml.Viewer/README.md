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

## Arrange and save

Class, aggregation and component diagrams have **⠿ move handles**. Drag a card's handle to move it, or a namespace frame's handle to move its visible cards together. Background dragging still pans. Arrow keys on a focused handle move by 10 diagram units; Alt moves by 1 and Shift by 40. Escape cancels an active drag. Header clicks continue to expand/collapse cards.

Moved cards become pinned. Their **●** button unpins them; **○** pins an automatic position. **Auto-arrange** recalculates unpinned positions while keeping pinned coordinates. **Reset layout** clears manual positions and pins. **Undo/Redo** restore arrangement changes; Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z work when the diagram has focus. Card positions, pins and layout history are kept separately for each view.

**Save arrangement** downloads `<diagram-id>.layout.json`. It contains positions, pins, grouping offsets, expanded/collapsed states, layout choice/direction, interface mode and the camera. The semantic diagram JSON is unchanged. To restore a view, first open its diagram and then use **Load arrangement** or drop the arrangement file onto the viewer. Keep both the diagram and its arrangement. Saving uses a download, so save again after further edits; this is not automatic disk saving.

Stable element IDs preserve positions when the diagram is regenerated. Arrangement files must match the document and view IDs. Removed objects are ignored; new objects receive automatic positions. Invalid, mismatched or excessive arrangement input is rejected. An arrangement is limited to 1 MB and 200 card positions. It does not contain source code, credentials or the full model.

Structural views offer **Inheritance · ours**, **Series-parallel · ours** and **Hierarchical · ELK**, with top-to-bottom or left-to-right member layouts. Classes start with the custom inheritance layout. **Namespaces: containers** is the default with all three choices: cards stay inside labelled frames, and container placement adapts to the viewport and cross-container relationships. Interfaces remain inside their namespace. **Namespaces: labels** is an optional compact mode. Series-parallel uses actual reduction/decomposition within each container and explains local hierarchical fallback. Sequence, activity and communication keep their type-specific geometry.

Choose **Namespaces & shared paths** in the example list to try the implemented router. **Connections: bundled / separate** changes routes while preserving positions and the original JSON. Compatible relationships share trunks; inheritance branches join a parent-facing trunk. Shared segments are drawn once and carry their original relationship IDs. Click one to inspect its members, then **Trace this relationship** to emphasise an individual path. Conflicting labels, multiplicities, kinds and directions use separate lanes. Unrelated crossings have small gaps. Namespace headers and unrelated containers are protected routing space.

In **Bundled** mode, cross-namespace connections gather at labelled **OUT** and **IN** socket banks and travel together in one directed, rounded coloured cable per namespace pair. Each bank has one label and tightly spaced individual sockets. Click a cable or socket to inspect its member relationships, then trace one relationship to follow its exact class endpoints. Ordered collector rails fan the cable out inside each namespace; compatible branches reaching the same class share a port and final run. Container padding reserves space for these rails, including while dragging cards.

A cable is an overview collection, not an extra UML relationship or an all-to-all connection. Its members keep their original kinds, directions, labels and multiplicities, with UML markers at expanded class endpoints. Collapsed namespace summaries retain their cable links; collection sockets omit semantic markers and multiplicities to avoid conflicting symbols, while the inspector retains the originals. **Separate** mode removes the overview cables and shows individual routes. Existing arrangement files remain compatible. These structural containers are flat, and routing uses bounded heuristics; crowded manual layouts may still need more space. See [the cable plan and focused checks](EDGE-ROUTING-PLAN.md#accepted-cable-revision).

Optional element `namespace` metadata creates containers automatically. Existing explicit groups retain their membership and meaning; optional group `kind: "namespace"` records namespace intent. Ungrouped objects without metadata appear under **Unassigned / global**. Containers are flat; nested namespace/custom-group composition is later work. Drag cards within their container or move the container with its handle. Group dragging explicitly translates its member pins; automatic arrangement preserves pinned coordinates and reports conflicting frames. Routing mode, offsets, pins and collapse state are saved in arrangement files; older files load with bundled routing.

Interface implementation lines can become **─○ shortcuts**, with reciprocal links on interfaces. Clicking a shortcut jumps to the shared object; Back returns to the previous selection. Full implementation lines remain available. Selecting a class dims unrelated cards and lines without moving them; Clear focus, Escape or clicking the background restores the overview. Namespace grouping, interface mode and layout selection are independent presentation decisions.

Lines follow moving endpoints with a lightweight preview and are refined on release using connection families, reserved terminal/gateway lanes, obstacles and bounded orthogonal path search. Routing is a heuristic; crowded manual arrangements may need more room. Obstructed connections are marked and remain inspectable. Keep checks lightweight during design: inspect real diagrams and the arrangement save/load cycle.

- [JSON format and named collapse states](JSON-FORMAT.md)
- [Connected views, shared IDs and project manifests](CONNECTED-VIEWS.md)
- [Published JSON Schema](schema/uml-document.schema.json)
- [Diagram types](DIAGRAM-TYPES.md)
- [Project plan](PROJECT-PLAN.md)
- [Rendering architecture](RENDERING-ARCHITECTURE.md)
- [Edge-routing visual prototype](prototypes/edge-routing/index.html) — fixed dummy layout with Bundled/Separate and connection focus.
- [Edge-routing plan](EDGE-ROUTING-PLAN.md) and [project memory](MEMORY.md).

## Examples

- [Bicycle aggregation](examples/bicycle-aggregation.uml.json): whole/parts and renamed expanded details.
- [Garage structure](examples/garage-structure.uml.json): named cards and a collapsible group.
- [Namespaces & shared paths](examples/namespace-routing.uml.json): automatic namespace frames, shared trunks and independently labelled parallel associations.
- [Garage · vehicle namespaces](examples/garage-vehicle-cables.uml.json): the real 29-element vehicle model with OUT/IN namespace cables, copied from the existing generated cached snapshot at commit `17dccad67c15168995d38148bda57cb59afc3a36`. No live Garage writes are required.
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
