# Rendering architecture and visual quality

Status: the shared core and six dedicated renderers are implemented, including activity flows. The connectivity index resolves shared elements/members to scoped occurrences; the UI owns navigation history and temporary reveal states. Project manifests assemble a shared catalogue and diagram sources before normal validation/indexing. See `CONNECTED-VIEWS.md` for the contract and `README.md` for running the viewer.

## Decision

Use a shared rendering foundation and a dedicated renderer for every supported diagram type. The JSON model describes meaning. The selected type renderer decides how that meaning should be arranged and presented.

The architecture supports consistent colors, typography and controls while allowing a sequence diagram, an aggregation diagram and a deployment diagram to look and behave appropriately for their type.

## Shared rendering core

The core owns reusable presentation infrastructure:

- HTML/SVG scene drawing and lifecycle management.
- Shapes, paths, borders, groups, compartments and labels.
- UML marker primitives such as hollow triangles, hollow/filled diamonds and call/reply arrows.
- Actual text measurement, wrapping, padding and reusable size calculations.
- Theme tokens for typography, spacing, colors, strokes and interaction states.
- Coordinate transforms, pan, zoom, fit and viewport resizing.
- Common focus, keyboard and accessible-label helpers.
- Hit testing, selection styling and common inspection controls.
- Cancellation or rejection of superseded asynchronous layouts.

These are implementation primitives. They do not become coordinates or styling fields in the human-edited UML JSON.

## Dedicated type renderer

Each supported type registers a renderer under its exact JSON `type`, for example `class`, `aggregation` or `sequence`. Related renderers may share helpers or a base implementation while retaining their own explicit entry point and visual policy.

Each renderer owns:

1. **Interpretation:** select supported model facts and validate type-specific combinations.
2. **Visual vocabulary:** choose the appropriate UML shapes, compartments, markers and grouping conventions.
3. **Measurement:** determine the required space for its labels, details and shapes using shared measurement utilities.
4. **Layout:** choose reading direction, ranking, alignment, nesting, lane placement and edge-routing policy.
5. **Scene construction:** produce positioned shapes, connectors, labels and stable references for the shared core to draw.
6. **Detail behavior:** define useful collapsed, expanded and focused presentations, plus type-specific details.
7. **Presentation guidance:** supply the correct legend, initial view and keyboard reading order.

The registry reports an unsupported type explicitly. It does not fall back to a generic node-and-arrow picture that could imply unsupported UML semantics.

## Proposed renderer contract

The precise code interface is finalized in milestone 1. Its conceptual inputs are:

- The validated shared model.
- The selected view and its referenced elements or interaction.
- Viewport dimensions and theme tokens.
- Session state: selection, expansion and filters.
- Shared text measurement, shape factories and layout utilities.

Its output is a scene containing positioned drawing primitives, connector routes, labels, semantic/source IDs, inspection data, reading order and suggested initial framing. Rendering can be asynchronous. The core applies the result only if it still belongs to the active document and view.

The scene is a rendering result, separate from the editable semantic JSON. Sequence and communication retain the same underlying participants and message IDs even though their scenes and layouts differ.

## Type-specific visual policies

These are design directions, subject to refinement with representative fixtures. Later types become supported only when their input semantics and renderer are implemented.

| Type | Visual priorities |
| --- | --- |
| Class | Clear class compartments; inheritance hierarchy where applicable; readable member summaries; secondary relationships routed around cards; logical group boundaries. |
| Aggregation | Make the whole prominent and arrange its parts clearly around or below it; place hollow diamonds at the whole; reuse class shapes and marker primitives. |
| Component | Emphasize component boundaries and directed dependencies; align related components; display explicit ports/interfaces when supported by the contract. |
| Sequence | Stable participant columns and lifelines; messages ordered vertically; call/reply distinction; measured labels; correctly nested alternative frames and explicit self-calls. |
| Communication | Emphasize collaborating participants and their links; preserve message numbering and guards; group dense message sets into expandable details. |
| Object | Instance names, readable attribute values and links between instances; visually distinguish instances from class declarations. |
| Package | Clear package containment and boundaries; readable labels for dependencies crossing packages. |
| Composite structure | Explicit containing structure, parts, ports and connectors; keep children and labels inside the intended boundaries. |
| Deployment | Nested device/runtime nodes, deployed artifacts and connections; maintain containment during resizing and detail expansion. |
| Profile | Distinguish stereotypes, metaclasses and extensions through correct notation and readable labels. |
| Use case | Actors outside the system boundary; use-case ellipses inside; readable include/extend relationships when those features are supported. |
| Activity | Clear flow direction; actions, decisions, merges, initial/final nodes and supported fork/join structures; guards beside their control-flow edges. |
| State machine | Distinguish states and transition triggers/guards/actions; route self-transitions clearly; preserve nested state boundaries when supported. |
| Interaction overview | References to shared interactions connected through supported control-flow structures; expand referenced details without obscuring decisions. |
| Timing | Explicit time axis, units, state levels and duration constraints; labels must distinguish measured data from illustrative input. |

The same engine can serve several types with different configurations. Other types can use custom geometry. For example, an orthogonal graph layout may help class/component diagrams, while sequence diagrams need ordered lifelines and timing diagrams need a time-based axis.

## Visual quality criteria

A renderer is complete when the diagram is understandable and usable, as well as semantically correct.

### Readability

- Measure labels and compartments; avoid relying only on character-count estimates.
- Keep text inside its intended shape, wrap predictably and expose full content when a summary is shortened.
- Use a consistent typographic hierarchy, spacing scale and stroke system.
- Maintain adequate contrast and convey relationship kinds through symbols and labels as well as color.
- Give labels enough space beside connectors, decisions, lifelines and group headings.

### Layout and routing

- Avoid overlapping nodes, compartments and important labels in the reference fixtures.
- Keep group/containment boundaries clear, with sufficient padding for headings and children.
- Prefer routes that reduce crossings and avoid running through unrelated shapes.
- Place arrowheads and diamonds at the correct semantic endpoint.
- Preserve ordering, nesting and direction constraints required by the selected diagram type.
- Recompute affected geometry after expansion or viewport changes, while keeping the user's context recognizable.

### Useful initial view

- Choose an appropriate summary or focus for dense input. Keep the complete model accessible through explicit controls.
- Treat fit-to-view as a camera action. A dense model also needs grouping, detail levels or focus to remain readable.
- Sequence and communication can begin at different detail levels while retaining the same message data.
- The type renderer proposes initial framing; the shared core preserves subsequent user camera choices during normal interaction.

### Responsive interaction

- Review representative desktop, tablet and narrow-window sizes, including approximately 1366, 768 and 360 CSS pixels in width.
- Keep controls usable when the canvas is narrow; large diagrams remain accessible through pan/zoom and focus.
- Make expanded details scroll where needed without accidentally taking over diagram zoom.
- Support keyboard access to elements and details with a meaningful reading order.

## Reference fixtures and verification

Each supported renderer receives:

- A small teaching example with an easy-to-check visual structure.
- A realistic medium example with several relationship or message cases.
- Long-label and expanded-detail fixtures.
- A dense example to exercise summary, grouping and focus.
- Type-specific edge cases, such as self-calls, nested alternatives, self-transitions or nested containers as applicable.

Automated checks verify semantic parity, correct markers, reference preservation and relevant geometry constraints. Visual reference images or screenshots, together with human inspection, assess text, hierarchy, routing and the overall presentation. Visual checks are part of each renderer milestone; final packaging consolidates them.

Changes to common theme, measurement or drawing primitives should be checked against every implemented renderer. Changes confined to one type primarily exercise that type and any shared utility they modify.

## Build order

1. Define the shared scene contract and class-renderer visual reference alongside the JSON schema.
2. Build the smallest shared drawing core needed for the class import/render workflow.
3. Finish class rendering quality, then add dedicated aggregation and component renderers using shared helpers.
4. Add sequence and communication renderers with independent layouts over one interaction model.
5. Extend the renderer registry with later types one at a time, including their input semantics and visual fixtures.

The shared core grows from concrete renderer needs. A new type can introduce a shared primitive where useful without requiring all types to adopt its visual structure.
