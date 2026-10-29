# UML JSON Viewer — project plan

Status: first usable implementation available in `index.html`. Five dedicated renderers support class, aggregation, component, sequence and communication. Named collapsed/expanded labels and visible-field lists are implemented. See `README.md` and `JSON-FORMAT.md` for use and current limits.

The milestones below record the design and ongoing acceptance criteria. Contract, geometry and DOM integration checks are included. Further UML types, generator integration and exports remain later work.

## Goal

Build a standalone viewer for human-readable, human-editable UML JSON. Automation can create the initial document; a person can adjust groups, dependencies or calls before loading it into the viewer.

The viewer understands the JSON contract. It has no dependency on Garage source code, a code generator, Roslyn or PlantUML input. A later `Uml.Generator` project will produce the same input format independently.

## User workflow

1. Obtain a JSON document from the future generator, a colleague or a hand-written example.
2. Copy it into a folder you control and edit it in a normal text editor.
3. Open the viewer and drop the file onto the page, or choose **Open JSON**.
4. Explore its diagrams, expand details and switch between available views.
5. Edit the JSON externally and load it again to see the changes.

Accepted JSON belongs to the user. Import and rendering never modify the source file. Generation happens in a separate output folder, so it cannot silently overwrite accepted edits. Manual transfer is a supported workflow.

The initial viewer is a local browser application. It reads explicitly selected or dropped files through browser file APIs. A `diagrams/` folder can organize accepted documents, but copying a file into it alone does not make a browser discover or watch it. Automatic folder scanning, watching and a localhost service are later options.

## First usable release

The release supports:

- Opening or dropping one self-contained JSON document.
- Clear validation errors that identify the file and relevant field.
- Structural class and component views with groups and typed relationships.
- An explicit `aggregation` view type for class-style whole–part diagrams, with hollow diamonds at the whole end.
- An ordered interaction model rendered as sequence and communication views.
- Switching views without maintaining separate copies of the same interaction.
- A visible UML type label on every diagram and its navigation entry.
- Fit, pan, zoom, search and expandable element details.
- Styling supplied by the viewer, separate from model content.
- A shared rendering core with a dedicated renderer and visual rules for each supported diagram type.
- Local operation with bundled assets and no required account or network connection.

The first delivery is deliberately smaller: one JSON file renders a structural diagram. Sequence and communication follow once that complete import/render workflow works.

## Boundaries

### Viewer responsibilities

- Parse and validate the document, including reference checks.
- Turn explicit model facts into type-specific diagram views.
- Compute layout and display accessible interactive diagrams.
- Preserve the last valid document when an import fails.
- Explain unsupported versions or features instead of silently dropping them.

### Generator responsibilities, in a later project

- Read application code, user stories or other source inputs.
- Produce JSON drafts that follow the published viewer contract.
- Keep extraction evidence and generated tracking data separate from the clean documents people edit.

### Later scope

The code generator, diagram-to-code editing, an in-app JSON editor, automatic file watching, cloud storage, collaboration and complete support for all 14 UML types follow separate milestones. PlantUML/SVG export follows the first usable interactive release. A timing view requires explicit time data; the viewer will not invent durations.

## Draft JSON contract

The examples use the implemented version 1 contract. `src/validation/contract.js` defines runtime validation and publishes `schema/uml-document.schema.json` through the build script. The [format guide](JSON-FORMAT.md) documents the supported subset and named collapse states.

| Section | Meaning |
| --- | --- |
| `version` | Input contract version, initially `1`. |
| `id` | Stable document ID. |
| `title` | Human-readable document title. |
| `elements` | Objects keyed by short, readable IDs; values describe UML elements. |
| `groups` | Named collections of element IDs for logical organization. |
| `relationships` | Explicit typed relationships between element IDs. |
| `interactions` | Named interactions containing participants and ordered steps. |
| `views` | Requested diagram types and the shared data each displays. |
| `views[].type` | Required diagram type, such as `class`, `aggregation`, `component`, `sequence` or `communication`. Aggregation is a class-style viewer preset. |

Decisions for version 1:

1. Documents are self-contained. Element, group and interaction references resolve within the document; importing a document does not fetch other files or URLs. Story and scenario IDs are descriptive annotations in version 1, so they do not require an external story catalogue.
2. Element IDs are readable aliases such as `service`, `garage` and `spot`. Display-name changes do not change those IDs.
3. Relationships and steps have their own stable IDs, making small edits and diffs understandable.
4. A dependency from `service` to `garage` means the service depends on the garage. Inheritance points from the derived class to its parent; implementation points from a class to an interface. The viewer supplies the corresponding symbols and legend.
5. Groups organize elements. A group does not establish UML ownership or composition. Package containment will have explicit semantics when supported.
6. Ordered arrays determine interaction order. `kind: "call"` and `kind: "reply"` distinguish messages. The viewer does not execute message labels as code.
7. A sequence and communication view reference the same interaction ID. They do not carry independent message lists.
8. Branches, when introduced, use a structured `alt` step with guarded branches and nested `steps`. Optional loops, parallel blocks and async behavior need explicit support; unknown step kinds fail validation.
9. Colors, fonts, coordinates, SVG, PlantUML syntax and generated hashes stay outside the model documents.
10. Validation establishes that a document can be interpreted consistently. The person accepting the document decides whether its modeled relationships and scenarios are appropriate.
11. Every view explicitly declares its UML diagram type. The type selects the interpretation, symbols and layout. The viewer does not infer it from the title or content. One document can provide several different types of view over shared data. Element `kind` and relationship `kind` describe their own model facts and remain separate from the view's `type`.
12. Human-authored `display` options define an element/group/frame's initial state, distinct names for each state and a `show` list of visible fields. Expansion is session state and never overwrites those defaults. This information presentation remains separate from colors, fonts and coordinates.

See [diagram types](DIAGRAM-TYPES.md) for the proposed type names and staged support. The viewer header and navigation will display friendly labels such as **Class diagram**, **Sequence diagram** and **Communication diagram**.

The parking example describes a simplified successful scenario for discussing the format. It is not a complete extraction of Garage's parking implementation.

## Architecture

```text
Selected or dropped JSON
        |
        v
Parse + schema validation + reference validation
        |
        v
Validated in-memory UML model
        |
        v
View projection: structural / sequence / communication
        |
        v
Renderer registry selects the declared diagram type
        |
        v
Dedicated type renderer: projection + measurement + layout + scene
        |
        v
Shared drawing core + theme + canvas interaction
        |
        v
Interactive HTML + SVG
```

The model exists before any output notation is generated. The pipeline does not generate PlantUML and parse it back to recover the model.

Keep these layers independently testable:

- **Input:** file selection, drop handling and document loading.
- **Contract:** parsing, supported versions, shape validation and reference validation.
- **Model:** normalized data, separate from browser state and layout coordinates.
- **Views:** resolve the selected entities or shared interaction without copying the model facts.
- **Type renderers:** each supported diagram type owns its visual structure, layout policy, label rules, detail levels and type-specific scene construction.
- **Rendering core:** shared text measurement, scene primitives, UML symbols, edge drawing, theming and accessible drawing utilities.
- **Layout utilities:** reusable algorithms and engine adapters, configured independently by each type renderer.
- **UI:** navigation, details, symbol guide, errors and camera controls.

Browser camera position, selected elements and expanded cards belong to session state. They do not rewrite the JSON model.

### Dedicated renderers, shared foundation

Every supported `views[].type` has a registered renderer module. Class, component, aggregation, sequence and communication each receive their own module. Future types follow the same pattern. A renderer can reuse shared shapes and layout helpers while controlling its own presentation.

The shared core provides the canvas, pan/zoom, typography tokens, theme, geometry primitives, relationship markers and common accessibility behavior. It does not choose every type's layout or turn all UML content into identical cards and arrows.

Each type renderer is responsible for:

- Interpreting its supported model features and preserving their UML meaning.
- Choosing an appropriate visual hierarchy and reading direction.
- Measuring its shapes, compartments and labels.
- Selecting and configuring layout/routing algorithms for that type.
- Building a scene for the common drawing core.
- Defining useful summary and expanded states, focus behavior and keyboard reading order.
- Providing the correct type label, symbol legend and type-specific details.

Examples: class inheritance should read as a hierarchy; aggregation should emphasize the whole and its parts; sequence should use ordered lifelines and alternative frames; communication should emphasize collaborating objects and numbered messages. A consistent theme ties these views together while their visual structures remain distinct.

See [rendering architecture and visual rules](RENDERING-ARCHITECTURE.md) for module responsibilities, proposed type-specific layouts and visual acceptance criteria.

## Initial technical direction

- Browser-native HTML, CSS and JavaScript, with modules arranged so the local-file entry page works.
- File selection/drop APIs instead of fetching arbitrary local JSON URLs.
- Locally bundled layout utilities. The existing pinned ELK bundle is a reuse candidate for suitable graph layouts; sequence, timing and other constrained types can use dedicated geometry.
- A renderer registry keyed by the explicit JSON diagram type, with shared drawing primitives and separate renderer modules.
- Adapt the current Garage viewer's layout and interaction lessons where useful, while removing Garage-specific data, names and required globals.
- Publish a JSON Schema for editor assistance, alongside semantic reference checks in the importer. Choose any schema-validation dependency during milestone 1 and bundle it locally.
- Development tooling may use Node. End users should be able to open the distributed viewer without installing Node or .NET.
- Preserve dependency licenses and provenance when reusing bundled assets.

## Milestones and completion criteria

### 1. Finalize the contract and examples

Deliverables:

- `schema/uml-document.schema.json`.
- A compact input-format guide.
- A rendering-core contract and an initial visual reference for the class renderer.
- Structural and successful-parking examples.
- Invalid fixtures for malformed input, missing references and unsupported features.

Complete when:

- A person can identify and change a dependency or call without editing renderer code.
- Every supported field has a documented meaning and default behavior.
- The examples pass schema and reference checks.
- Each example view has an explicit type; missing, unknown or currently unsupported types have distinct errors.
- Error messages identify unknown IDs, duplicate IDs, invalid kinds and unsupported versions.

### 2. First working vertical slice: import and structural rendering

Deliverables:

- A standalone entry page with **Open JSON**, a drop zone, a diagram canvas and an error panel.
- Parsing and validation before the active document is replaced.
- Rendering of classes, groups and dependency arrows from `garage-structure.uml.json`.
- A dedicated class renderer using the shared scene/drawing core, theme and text measurement.
- Fit, pan and zoom.

Complete when:

- The distributed page opens locally and accepts the example through file selection and drag-and-drop.
- The diagram and navigation both display **Class diagram** for the structural example.
- Changing a relationship's target in the JSON and reopening it visibly changes that arrow.
- An invalid replacement leaves the previous valid diagram visible, alongside a useful error.
- Opening a different document does not retain the previous document's filters or relationships.
- Nodes, labels and group headings are measured and readable in the initial class view; resizing and expansion are visually reviewed against the class reference.

### 3. Structural views that remain readable

Deliverables:

- Separate class and component renderers with explicit supported element kinds and their own layout policies.
- Dependency, association, inheritance, implementation, aggregation and composition symbols with a symbol guide.
- A dedicated aggregation renderer, exercising the bicycle example and emphasizing whole–part arrangement while reusing class shapes and relationship markers.
- Group presentation, expandable members, search and focus.
- Responsive layout and keyboard-accessible controls.

Complete when:

- Supported relationships retain their kind and direction when rendered.
- Groups do not accidentally introduce ownership or relationships.
- Expanding a card recalculates layout without covering adjacent cards.
- Long labels and member lists remain usable in a constrained viewport.
- A larger fixture remains navigable through grouping, search and detail expansion.
- Class, component and aggregation views each meet the visual criteria in `RENDERING-ARCHITECTURE.md`, with their own reviewed reference examples.

### 4. One interaction, two views

Deliverables:

- Separate sequence and communication renderers of `parking-success.uml.json`, using one shared interaction model.
- Calls and replies, readable ordering and expandable message details.
- Structured guarded alternatives, with shared branch context across both views.

Complete when:

- Changing one call's source, target or label updates both views after reload.
- Both views preserve the same participants and message identities.
- Replies stay distinguishable from calls.
- Alternative branches retain their guards and ordering without appearing as one unconditional execution.
- Unsupported interaction constructs produce an explicit error.
- Sequence lifelines, message labels and alternative frames remain readable; communication uses a collaboration layout with its own message-detail presentation.
- Each renderer is visually reviewed at representative viewport sizes and with long-label and expanded-detail fixtures.

### 5. Polish, package and document

Deliverables:

- Consolidation of the visual theme developed throughout the earlier milestones, independent of model content.
- Clear empty, loading, success and error states.
- A distributable local viewer folder, input guide and examples.
- Automated contract, projection and layout checks, plus a documented visual review checklist.

Complete when:

- A clean copy opens without Garage, the generator, a network connection or an account.
- The documented import/edit/reload workflow succeeds with the supplied files.
- Failed or superseded imports cannot leave a mixture of two documents on screen.
- Untrusted labels display as text, and input size/complexity limits fail clearly.
- The supported version 1 feature list matches the implementation and examples.
- Every supported type has a dedicated renderer entry, documented visual rules and a matching visual regression/reference fixture. A type is complete when its semantics, usability and visual presentation have all been checked.

## Proposed project layout

```text
Uml.Viewer/
  index.html                 Viewer entry point
  src/
    input/                   File loading and import handling
    validation/              Contract and reference checks
    model/                   Normalized UML model
    views/                   View selection and model-reference resolution
    rendering/
      registry.js            Dispatch by the declared diagram type
      core/                  Scene primitives, painter, text measurement, UML symbols
      types/
        class.js             Class-specific projection, layout and scene
        aggregation.js       Whole–part arrangement, reusing shared class shapes
        component.js         Component-specific projection, layout and scene
        sequence.js          Lifelines, ordered messages and alternative frames
        communication.js     Collaboration links and message-detail presentation
    layout/                  Reusable layout algorithms and engine adapters
    ui/                      Canvas, controls, navigation and details
  themes/
    default.css
  vendor/                    Local dependencies and licenses
  schema/
    uml-document.schema.json
  examples/                  Readable input examples
  diagrams/                  Optional organization folder for accepted JSON
  tests/
    fixtures/
  README.md
  PROJECT-PLAN.md
  RENDERING-ARCHITECTURE.md
```

The implementation follows this layout. Drawing is in `src/rendering/core/painter.js`, measurement in `measure.js`, and each supported type has its own module. The optional development preview server is separate from the offline entry page.

## Practical risks and responses

| Risk | Response |
| --- | --- |
| Supporting every UML type immediately delays a useful viewer. | Complete structural import/render first; add shared interaction views next. |
| Dense input still produces a dense diagram. | Design grouping, summary views, search and progressive details alongside layout. |
| One generic layout makes distinct UML types look alike or read poorly. | Use a dedicated renderer per type, sharing drawing primitives and choosing layout policies independently. |
| Each renderer duplicates the entire canvas and style system. | Keep drawing, text measurement, themes, symbols and camera behavior in the shared core. |
| Visual quality is deferred until the application is nearly finished. | Include type-specific reference examples and visual acceptance criteria in every renderer milestone. |
| Reusing the Garage viewer preserves hidden application assumptions. | Exercise the importer and renderer with unrelated and renamed fixtures. |
| Copying generated output replaces human edits. | Keep generator output and accepted viewer documents in separate locations. |
| A loosely defined JSON format becomes difficult to maintain. | Finalize a small versioned contract and reject unsupported constructs clearly. |
| Different views disagree about one interaction. | Project both views from the same validated interaction model and test message parity. |
| An offline page attempts to discover arbitrary local files. | Use explicit file selection/drop in version 1 and document the folder workflow accurately. |

## Later integration with the generator

Once the viewer contract is working, create `Uml.Generator` separately. It will produce documents that already pass the viewer's validation fixtures. Its first integration task is exporting one existing Garage interaction into this format. The manual copy/import workflow remains supported; automatic handoff can be added later without coupling the projects.

## Next implementation task

Finalize the structural example, schema and shared scene contract, then build milestone 2 with the dedicated class renderer. The first demonstration should show a visible dependency changing after a small external JSON edit and reload, with measured labels and a reviewed class-diagram layout.
