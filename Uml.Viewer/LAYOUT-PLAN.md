# Selectable layouts — implementation plan

Current milestone implemented: [coordinated edge routing](EDGE-ROUTING-PLAN.md), visible containers with custom/ELK layouts, shared trunks, reserved lanes and connection-aware member ordering. Try the built-in **Namespaces & shared paths** example; the [dummy](prototypes/edge-routing/index.html) also shows namespace frames. Persistent decisions, scope and constraints are indexed in [MEMORY.md](MEMORY.md). This requirement supersedes the earlier label-only custom-layout milestone below.

Status: first implementation available. Custom inheritance and series-parallel placement, ELK fallback, direction selection, interface shortcuts, focus, draggable cards/groups, pins, arrangement save/load and undo/redo are implemented. A generic multi-engine registry and future Organic/Circular engines remain later work. Implementation modules are `src/layout/structured.js`, `src/layout/edge-router.js`, `src/model/arrangement.js`, `src/ui/arrangement-drag.js` and `src/ui/arrangement-controls.js`. The sections below retain the broader design direction; see README.md for currently supported behaviour and constraints.

## Goal

Let the user view the same diagram through different arrangements, starting with series-parallel. Layout changes affect positions and routing, never UML identities, endpoints, relationship kinds, method data or source JSON.

Keep the viewer offline and keep the existing type-specific renderers. Sequence diagrams retain their ordered lifelines; a general graph layout selector must not rearrange their message order.

## Library decision

Keep bundled ELK as the hierarchical/general-graph engine. Implement a separate series-parallel adapter behind a common registry. ELK's documented algorithm list does not include a dedicated series-parallel algorithm. Do not relabel a layered-layout preset as a series-parallel implementation.

The referenced yFiles library provides this algorithm and many advanced routing features, but requires a commercial licence. No yFiles dependency, evaluation package or licence is added by this plan. Its SDK could be evaluated later behind the same adapter contract if maintaining a custom algorithm becomes too costly.

Sources: [yFiles layouts](https://www.yfiles.com/the-yfiles-sdk/features/automatic-layouts), [series-parallel semantics](https://docs.yworks.com/yfiles-html/dguide/seriesparallel_layout/), [ELK algorithms](https://eclipse.dev/elk/reference/algorithms.html), [yFiles licensing](https://www.yworks.com/faq?id=1065).

## 1. User controls and state

Use separate controls for separate decisions:

- Layout: Series-parallel / Hierarchical initially. Tree, Organic and Circular are future additions, available only after their adapters work with the bundled runtime.
- Direction: top-to-bottom / left-to-right.
- Grouping: namespace frames by default / namespace labels as an optional compact view. Custom layouts must preserve the frames. This replaces the ambiguous current use of “Layout” for grouping.
- Interfaces: shortcuts / full lines.
- Clear focus: restore the overview without recomputing node positions.

Remember layout, direction, grouping, interface mode, collapse state, focus and camera separately for each view during the session. Start class views with series-parallel requested and show the engine actually used. Preferences stay in viewer state; no diagram schema or generator changes are required for version 1.

Changing a layout recalculates geometry and fits the complete result. Selecting a class only changes emphasis. Expanding a card recalculates the space it needs while retaining the selected object. Back navigation restores the previous view's state.

## 2. Architecture

```text
Validated model + view state
    → visible graph and measured cards
    → layout graph / primary connections
    → chosen node-placement engine
    → edge routing and label placement
    → shared scene and painter
```

Suggested modules:

```text
src/layout/
  registry.js                 Available engines and capabilities
  request.js                  Visible graph, dimensions, IDs and primary/secondary edges
  engines/
    hierarchical.js           Adapter around existing ELK layered layout
    series-parallel.js        Recognition, decomposition and positioning coordinator
  series-parallel/
    decompose.js              Series/parallel reductions and decomposition tree
    place.js                  Measured composition of chains and branches
  routing/
    orthogonal.js             Collision-aware routing for fixed card positions
    ports.js                  Stable connection entry/exit points
  routes.js                   Remove redundant points and safe detours
```

An engine reports positions, preferred routes where available, overall bounds, the requested/applied engine, the graph it laid out and any fallback reason. The renderer keeps semantic interpretation, UML markers, interface shortcuts and scene construction. The shared painter does not contain engine-specific positioning logic.

Capabilities declare supported diagram types, grouping modes and graph restrictions. Incompatible choices are disabled or produce an explained fallback; they must not silently remove groups or connections.

## 3. Series-parallel first version

Start with class diagrams and the generated vehicle hierarchy.

1. Build a layout graph using inheritance as the primary structure. Reverse its direction for placement so parents appear above children; exported/rendered UML arrows still point from child to parent.
2. Keep interface shortcuts available outside the primary skeleton. Full interface lines, associations and dependencies remain separate visible connections. They are not deleted from the model.
3. Split disconnected components. Internal virtual terminals can normalize compatible components; these are layout helpers and never visible UML objects.
4. Recognize series-parallel structure using series and parallel reductions while retaining a decomposition tree and original IDs. Failure to reduce completely means the selected graph is not supported by this engine.
5. Compose series blocks along the main direction; place parallel branches side by side; measure each subtree from real card dimensions. Shared split/join nodes appear once. Pack disconnected components with consistent gaps.
6. Route secondary connections around the positioned cards after placement.

Distinguish the complete semantic graph from the layout backbone. A class layout using only inheritance for placement must report “Series-parallel · inheritance backbone”, rather than claiming every displayed relationship forms a series-parallel graph. Spatial order does not imply execution order.

When the chosen local primary graph cannot be decomposed, use the hierarchical engine for that container and show why. Do not introduce fake parents, omit inconvenient links or silently change a cycle into a tree. Custom layouts now retain measured containers by default. Member placement, container placement and boundary-aware routing are described in EDGE-ROUTING-PLAN.md. An explained engine fallback preserves the containers.

Activity split/join layouts are a later adapter extension. Their control-flow semantics need their own graph preparation; class-diagram assumptions must not be reused blindly.

## 4. Routing quality

Node placement and line routing are separate responsibilities. A well-positioned graph can still have poor lines.

- Choose stable ports with correct arrow direction and adequate distance from card corners.
- Prefer a direct route or one elbow when it clears all cards and labels.
- For obstructed routes, use orthogonal obstacle routing with a bend penalty; consider crossings and long shared runs as additional costs.
- Preserve valid engine-provided routes when no safe improvement exists.
- Keep individual edges inspectable, even if some segments share a corridor.
- Route self-links and edges between collapsed groups explicitly.
- Never simplify a line through a class card to save a bend. Keep labels attached to the final route.

The current simplifier is useful post-processing, not a replacement for a full fixed-position router. The series-parallel milestone is complete only when secondary connections can be routed safely around its output.

## 5. Focus and interface behaviour

Keep the current interface-shortcut direction: a class links to its interfaces; interfaces link back to implementing classes. These are labelled navigation controls, with full UML implementation lines available as an option. The shortcut presentation does not alter realization semantics.

Selecting a class keeps it, its immediate neighbours and incident lines clear. Dim unrelated items without blur, so users retain orientation. Unrelated cards remain selectable. Clear focus, Escape or a background click restores the overview. Focus does not trigger layout or move the graph.

## 6. Delivery sequence and acceptance

1. Introduce the registry and wrap the existing hierarchical layout without changing its diagram meaning.
2. Add the selector, direction and grouping controls, with requested/applied layout status and per-view state.
3. Implement actual series-parallel recognition and measured placement, including disconnected components and explained fallback.
4. Connect fixed-position routing, interface navigation and focus to the result.
5. Review the real Garage domain and vehicle diagrams, then refine spacing and routing before adding more engines.

Keep checks light while the design evolves: a chain, a split/join example, a deliberately incompatible graph, and the two generated Garage diagrams. Inspect collapsed/expanded cards and focused/overview states. Verify no overlapping cards, valid endpoints, preserved relationship IDs, honest fallback, unchanged JSON and correct Back navigation. No large new test suite is planned at this stage.

Later: Tree for inheritance exploration; Organic for dense networks; Circular as an optional overview. Orthogonal routing remains a line style distinct from a dedicated orthogonal node-placement algorithm.
