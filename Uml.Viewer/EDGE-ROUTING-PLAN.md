# Coordinated connections — implementation plan

Recorded: 2026-10-30. Status: the **namespace-pair cable revision is delivered**, including shared OUT/IN socket banks, coloured overview cables and local collector rails. See MEMORY.md for delivered scope, focused verification and limits. Routing remains a bounded heuristic rather than a guarantee of an optimum or crossing-free result for arbitrary graphs.

## Accepted cable revision

The user found the full graph difficult to follow after the first family-routing revision. Collision-free individual routes were insufficient. The cable revision follows the supplied sketch: tight shared runs, clear branches and compatible routes merging into a series/tree line when they reach the same target.

- Plan one directed overview cable for a namespace pair, with a clear source **OUT** point and destination **IN** point. Boundary points use compact socket banks with 18-unit spacing and one OUT/IN label per bank; each coloured socket remains independently inspectable. The cable is a collection of original relationships, rather than an extra UML edge.
- Gather local class branches before OUT, travel together between containers, then fan out after IN. Replace per-class namespace gateways in this mode. Order branches and their boundary attachment together to reduce crossings.
- Prefer direct or low-bend cable runs. Keep a short straight approach at boundary points. Avoid repeated folding, border re-entry and long nested detours. Reserve enough space for the cable before routing local branches; widen an automatic corridor or report a manual-layout obstruction when required.
- Merge compatible local branches with the same destination into a shared target-facing trunk. Preserve distinct endpoint annotations, kinds or directions when sharing would obscure meaning. This is independent of the selected node-placement algorithm.
- Use a restrained, consistent cable colour, a count and explicit OUT/IN cues. Labels, shape and focus must remain useful without colour perception. A shared cable should remain visually quiet until selected.
- Mixed relationship kinds may be members of one overview cable. Do not give the cable a UML arrowhead, diamond or parent triangle that would falsely describe all of its members. Keep these markers, roles and multiplicities at their actual class endpoints. Counts and membership never imply all-to-all connectivity.
- Clicking or keyboard-activating a cable or boundary point lists its original relationship IDs. Individual trace highlights the exact source branch, cable membership and destination branch without moving cards or illuminating unrelated fan-outs.
- Separate mode continues to expose individual routes and UML styles. Switching modes must preserve semantic JSON, selection where possible, card positions and pins. Compact label mode and collapsed-container proxies must keep their existing meanings.

Acceptance for continued refinement: inspect the small namespace example and the real Garage diagram at the same viewport/detail state. Confirm planned OUT/IN locations, an obvious shared corridor, reduced folding, deliberate fan-out order, compatible same-target trunks, protected headers/cards, preserved IDs/endpoint markers, usable inspection/trace and working mode/drag/collapse/save-load interactions. Keep checks focused while the design evolves.

Current verification: the real 29-node Garage fixture passed custom inheritance and series-parallel geometry checks with 38 drawn edges plus 16 shortcuts, 24 external links consolidated into 5 cables and 10 sockets. ELK with full interface lines retained 54 edges with 6 cables and 12 sockets. These checks reported no routing warnings, card/header hits or immediate 180-degree folds. DOM checks on the small example passed cable inspection, Separate mode switching, arrangement restore and collapse/re-expansion; imported JSON stayed unchanged. This is evidence for those fixtures and modes, not a claim of zero crossings or globally optimal routing for arbitrary inputs.

## Problem and goal

The initial vehicle overview had many long, overlapping, difficult-to-trace routes. Its original router planned edges independently. The first production revision added containers, compatible families, shared segments and occupancy-aware routing, but many different class endpoints still produce separate external paths and repeated border detours. The cable revision coordinates those paths at namespace-pair level rather than treating a successful collision check as the readability goal.

Coordinate card placement, connection families, ports, corridors, routes and labels. Preserve the semantic model and every relationship's identity. The first milestone is a readable Garage vehicle diagram, not another layout-engine selector.

Namespace containers are part of the default structural overview. Classes appear inside a visible container rather than displaying namespace text alone, including with custom inheritance/series-parallel layouts and ELK. The dummy now includes namespace frames; the built-in **Namespaces & shared paths** example exercises the production pipeline.

## Visual reference

Open `prototypes/edge-routing/index.html`, or `/prototypes/edge-routing/index.html` with the optional preview server. This fixture shows inheritance sharing, direct vehicle/specification pairs, same-endpoint bundling with inspectable roles, separate parallel lanes and a clearly non-joining dependency crossing. All coordinates and relationships are illustrative. It does not claim to extract current Garage facts or run a routing algorithm.

For the implemented pipeline, select **Namespaces & shared paths** or **Garage · vehicle namespaces** in the main viewer. The Garage example is `examples/garage-vehicle-cables.uml.json`, copied from the existing generated cached snapshot at commit `17dccad67c15168995d38148bda57cb59afc3a36`; it does not require changing or reading live Garage sources.

## Connection compatibility

The table below governs typed local branches and semantic endpoint presentation. A namespace overview cable may carry several kinds without replacing them with one typed UML relationship. Separate mode exposes the individual routes.

| Case | Rule |
| --- | --- |
| Same endpoints and compatible kind/direction/markers | May summarise as one path with a count; all members and endpoint annotations remain inspectable. |
| Several subclasses with one parent | Use a common inheritance bus, branches and a parent-facing hollow triangle; retain child-to-parent semantics. |
| Common source or common destination | May share a local trunk if style and endpoint semantics agree. Keep distinct branches and do not force a global bus. |
| Different kinds, opposing directions, differing markers or conflicting annotations | Use separately traceable parallel lanes. Do not disguise them as one UML relationship. |
| Unrelated routes | Do not permit coincident runs or accidental T-junctions; use separate lanes and explicit non-joining crossing treatment. |
| Self-edges / collapsed groups | Handle explicitly; retain original IDs and distinguish proxy relationships. |

Bundling distinct roles between the same pair is an overview presentation. Show a count and list both roles when selected; Separate mode must reveal individual paths and annotations. When endpoint labels or multiplicities cannot be represented unambiguously, keep lanes separate by default. Do not deduplicate semantic facts because they share endpoints. Do not bundle sequence messages with this structural-diagram policy.

## Data pipeline

```text
Validated semantic model + visible view + measured cards + arrangement state
  -> namespace membership and measured container headers/padding
  -> topology and connection-aware ordering within containers
  -> positioned cards and containers (respect pins and membership)
  -> namespace-pair cable membership, OUT/IN points and reserved cable corridors
  -> compatible connection families
  -> stable ports and planned split/join points
  -> reserved corridors and lanes
  -> route network + labels + markers
  -> painter + relationship-aware interaction
```

Maintain separate representations:

- Semantic relationship: original ID, endpoints, kind, direction, roles, multiplicities, labels, context and evidence.
- Namespace container: stable view/group identity, actual qualified namespace, member IDs, header/padding, bounds and expanded/collapsed presentation. Container membership does not create a UML relationship.
- Family: stable ID, compatible style, common endpoint or endpoint pair, ordered member IDs and branch terminals.
- Namespace cable: source/target container IDs, restrained colour, original member relationship IDs, explicit OUT/IN geometry and an external overview path. It is separate from local typed branches and never enters the semantic model.
- Route network: shared segments, intentional junctions, independent crossings, terminal markers and per-relationship traversals.
- Segment: geometry plus member relationship IDs. Markers and annotations belong to explicit terminals/relationships, not arbitrary segment ends.

Presentation junctions are not UML nodes and never enter the imported model. A shared trunk is drawn once. Hit testing returns its member IDs. Focusing a relationship highlights its ordered traversal through that network. An aggregate that mixes primary and context relationships must not dim or reveal the wrong members.

## Placement

Keep inheritance ranks and parent/child direction within the containment constraints. Use secondary relationship weights to order siblings and coordinate related containers: a vehicle and its corresponding specification should be close and aligned where practical, while remaining inside their own namespaces. Avoid hard-coded matching by class name. Preserve deterministic tie-breaking by stable IDs, actual card dimensions, namespace boundaries and pinned coordinates. Cross-namespace inheritance keeps its true child-to-parent direction even when containers prevent globally aligned ranks.

Reserve inter-row/inter-group routing space based on lane demand. Placement and routing can negotiate a bounded spacing adjustment for congested channels. If pins prevent improvement, keep pins and expose the limitation rather than routing through cards. Retain all semantic edges even when only inheritance forms the layout backbone.

The cable revision reserves extra namespace padding for local collector rails. Compatible branches reaching the same class share their port/final run. Member dragging remains within the usable interior so it cannot consume this reserved rail space. Collapsed namespace summary cards keep their overview cable links and original relationship memberships.

## Namespace containers

- Default structural overview: one clear container per actual namespace, for example `Garage.Vehicles`, `Garage.VehicleSpecifications` and `Garage.Vehicles.Types` where these occur in the input. Use explicit namespace/group data, not guesses from class names. Preserve other explicit grouping information separately; do not silently reinterpret every existing group as a namespace.
- Classes, interfaces and enums appear inside their namespace. Interface shortcuts remain available, but the current global interface shelf must not pull interface cards out of their namespace containers in this mode.
- Use full namespace names in a distinct header, an element count, comfortable internal padding, subtle borders/background tint and adequate space between containers. Colour is supplementary; text identifies membership. Lines must not cross header text or make containers appear connected when they are only adjacent.
- Start with flat containers for qualified namespace names. Do not infer nested boxes from dots alone; explicit namespace nesting is later work. Objects without namespace information use a clearly named unassigned/global container, without inventing a namespace fact.
- Place members within each container, compute its size, then arrange containers using their actual cross-namespace connections. Allow bounded refinement between these stages to reserve lanes and improve alignment. Containers must not overlap or be resized independently of their visible contents.
- Route internal connections inside their container. Cross-namespace paths leave and enter through deliberate boundary gateways, with reserved space between containers. A gateway is geometry, not a semantic endpoint or UML port. Keep arrowheads, diamonds, roles and multiplicities at their correct class endpoints.
- Treat unrelated containers and all container headers as obstacles. A source/target container can be traversed to reach its own members; treating every complete container rectangle as an opaque obstacle would incorrectly block those routes. Do not use an unrelated container as a shortcut corridor.
- Preserve expand/collapse and group dragging. Dragging a class does not change its namespace; keep it contained or expand its container appropriately. Moving a container translates its members as a group. Preserve existing pin guarantees, and expose conflicts with individually pinned members rather than silently moving them.
- Collapsed containers expose summary connections with original relationship IDs retained. Expanding restores member endpoints and detail state. Save container positions/collapse state with the arrangement, not semantic JSON.
- Namespace frames are independent of Bundled/Separate. Both connection presentations must work with containers. Namespace labels can remain an optional compact mode; custom layouts must not silently flatten the default containers to labels.

## Routing

For the cable revision, reserve namespace-pair OUT/IN points and their shared corridors before the family-routing steps below. Route local source/destination fans to those points. Shared overview geometry can contain mixed semantic kinds; compatible local same-target merging still uses the original relationship styles and endpoint rules.

1. Build connection families from visible relationships before calculating paths.
2. Assign stable ports by endpoint side, kind and destination order. Reserve marker, label and corner clearance. Close parallel terminals must remain distinct at normal viewing zoom.
   Reserve namespace boundary gateways and inter-container corridors as part of the same plan. Container borders may be crossed only deliberately; their headers remain protected.
3. Route inheritance families first, reserving their buses and branches.
4. Allocate orthogonal corridors and parallel lanes to remaining families, accounting for existing occupancy. Compatible reuse is allowed; unrelated collinear overlap is forbidden.
5. Optimise lexicographically: hard obstacle/semantic constraints first, then crossings and ambiguous near-overlaps, bends, excessive length, and movement from the last accepted route. Bound search and refinement work.
6. Use a bounded deterministic reroute pass for congested families, not a claim of globally optimal routing. Expand available corridors during auto-arrange where possible.
7. Place labels and endpoint annotations after routes, with collision checks. Preserve mandatory UML markers at their proper whole/parent/target ends.
8. Distinguish intended joins from crossings. Use a small bridge/gap or halo at unrelated crossings; no accidental junction dots. Zoom and focus must keep this distinction visible.

Do not discard engine routes before a replacement has passed geometry checks. Route invalidation includes card size/position, collapse state, interface mode, grouping, viewport-driven placement and occupied-channel changes.

## Interaction and persistence

- Connections: Bundled / Separate. Independent of Inheritance, Series-parallel or ELK placement.
- Selecting a card emphasises its complete incident relationships through bundles without moving cards.
- Clicking a shared trunk lists member relationships; each remains individually selectable, keyboard accessible and linked to its evidence/tests.
- Separate mode exposes member paths and endpoint annotations. Keep selection stable across the switch.
- During dragging, update cheap attached geometry; on release, reroute affected families plus conflicts. Do not run full graph search on each pointer move.
- Preserve card pins, undo/redo and focus. Reframe groups without losing their semantic members.
- Save routing preference in the companion arrangement format with backward-compatible loading. Recompute paths from geometry; avoid persisting fragile SVG polylines in semantic JSON.

## Proposed modules

```text
src/layout/routing/
  families.js     Compatibility policies and stable grouping
  ports.js        Terminal placement, ordering and marker clearance
  channels.js     Corridors, occupancy and lane allocation
  router.js       Obstacle-aware paths and bounded refinement
  segments.js     Shared geometry and relationship traversals
  labels.js       Labels, multiplicities and endpoint annotations
```

Keep card-placement heuristics in the placement layer. Adapt the painter to draw shared segments and terminal markers separately; adapt focus, hit testing, inspection, counts and drag updates to use relationship membership. Existing arrangement overlays currently call `EdgeRouter.scene`; make routing ownership explicit so the final network is not overwritten by a later per-edge pass.

## Delivery order

First implementation delivered: model/container preparation, connection-aware local ordering, measured frames, responsive container placement, compatible connection families, stable ports and boundary gateways, occupancy-aware orthogonal routing, shared-segment membership and markers, collision-aware labels, Bundled/Separate, focus/inspection, collapse, dragging and arrangement persistence. The sequence below records the agreed development order; further refinement should be driven by real diagrams and the acceptance criteria rather than assuming globally optimal routing.

1. Dummy visual prototype and project memory, including the namespace-container revision (delivered).
2. Namespace containment and measured frames in custom layouts, member/container placement, and protected routing corridors. Retain ELK as an alternative.
3. Shared inheritance buses and independent parallel lanes, on the existing vehicle model; relationship-aware segments and inspection included.
4. Connection-aware sibling/container ordering, paired alignment and lane-demand spacing.
5. Broader safe source/target bundling, labels and markers, Bundled/Separate control.
6. Container/card drag, collapse and pin integration, undo/redo, arrangement preference and incremental refinement.

Use the same generated vehicle JSON to assess each step. Do not hide relationships to make the overview appear successful.

## Acceptance and lightweight verification

Inspect before/after at the same viewport and detail state. Record unrelated overlaps, card/label intersections, perpendicular crossings, bends and long detours. Differentiate shared compatible geometry from accidental overlap in these counts.

Review a small split/join inheritance fixture, compatible same-pair connections, conflicting kinds/roles/multiplicities, bidirectional links, self-edges, collapsed groups and the real Garage diagrams. Verify:

- Every original relationship ID and endpoint remains intact and accessible.
- Each namespaced class/interface/enum is visibly inside its correctly labelled container; containers and headers do not overlap, and grouping never changes namespace facts.
- Internal routes stay within their namespace; external routes use clear boundary gateways and avoid unrelated containers/headers. Both routing modes and all supported structural placement engines preserve this containment.
- Shared inheritance buses and branches read unambiguously.
- Unrelated connections never have indistinguishable coincident runs.
- No route passes through a card; labels and markers remain legible.
- Focus highlights only the selected memberships, without layout movement.
- Dragging, resizing through expansion, pinning, undo/redo and save/load remain usable.
- Repeated layout is deterministic; local edits do not shuffle unrelated routes unnecessarily.
- Readability improves on the real diagram, with meaningful reductions in crossings/bends rather than only thinner strokes.

Keep checks small during design; no large permanent test suite is required at this stage. Some graphs require crossings; show them clearly rather than promising a crossing-free result. No Garage writes, commits or pushes are part of this work.
