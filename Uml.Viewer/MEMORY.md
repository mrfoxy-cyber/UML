# Viewer project memory

Updated: 2026-10-30.

## Current design direction

The vehicle overview remained too cluttered after per-relationship family routing. The delivered revision uses **namespace-pair cables with explicit OUT and IN points**. Continue refining readability on real diagrams before adding more layout engines; passing collision checks alone does not establish visual quality for every graph.

The accepted direction is recorded in [EDGE-ROUTING-PLAN.md](EDGE-ROUTING-PLAN.md). Start there when continuing this work. The [interactive dummy](prototypes/edge-routing/index.html) illustrates the presentation with fixed geometry and namespace frames. The real viewer implements the cable pipeline; select **Namespaces & shared paths** for a small example or **Garage · vehicle namespaces** for the real cached vehicle model without importing a file.

- Compatible connections may share trunks; unrelated connections must not accidentally coincide.
- In Bundled mode, collect cross-namespace relationships around one planned namespace-pair cable. Give the source boundary a clear **OUT** point and the destination boundary a clear **IN** point. Local class branches gather before the output and separate after the input. Do not allocate a different namespace gateway to every class relationship.
- Plan the cable corridor before its individual fan-outs. Use tight, consistently ordered runs with gentle elbows and few turns. Avoid leaving a namespace, folding back over its border, or separating immediately into long parallel detours. Prefer direct paths and compatible same-target series/tree trunks, as in the user's sketch.
- A namespace cable is an overview collection, not a new UML association, dependency, ownership relation, or all-to-all connection. Original relationship IDs, endpoints, kind, direction, labels and multiplicities remain intact and inspectable. UML triangles, diamonds and arrowheads remain at their actual class endpoints, never at namespace OUT/IN points.
- Give cables restrained, consistent colours and visible counts/OUT/IN cues. Colour supplements shape and text. Mixed relationship kinds can travel in the same overview cable without being merged semantically; inspection and individual trace reveal their original meanings.
- Same-endpoint connections can be summarised only when their UML meaning remains accessible. Preserve relationship IDs, direction, kind, labels, endpoint roles and multiplicities.
- Several subclasses may join one shared inheritance bus. Association, realization and whole/part markers require separate compatibility rules.
- Use stable ports, deliberate branches, reserved parallel lanes and recognisable non-joining crossings.
- Consider secondary relationships when ordering cards; align related vehicle/specification classes where practical. Respect pins.
- Namespace containers are the default structural overview: classes/interfaces/enums sit inside a visibly labelled frame for their actual namespace, with padding, a quiet background and a readable namespace header. Support this with custom layouts as well as ELK; labels alone do not satisfy the requirement. Arrange within containers, then arrange containers and route between them. Container boundaries and headers participate in routing. Preserve namespace membership while dragging; a collapsed container is a presentation proxy, never a replacement semantic endpoint.
- Keep shared geometry separate from semantic relationships. Each drawn segment must know its member relationship IDs for selection and inspection.
- Bundled/Separate is a routing choice, independent of the node-placement algorithm.
- Focus must not move the graph. During dragging, use a lightweight preview; refine affected routes on release.
- First delivery target: make the existing generated Garage vehicle diagram readable, then broaden support.

## Continuing constraints

- Garage access remains strictly read-only. Viewer work must not edit Garage sources.
- Keep semantic diagram JSON unchanged. Arrangement files store presentation preferences and positions.
- Do not commit or push unless the user asks; the user handles their Git workflow.
- Keep verification lightweight while the design changes. Inspect representative diagrams and interaction flows rather than expanding the permanent test suite.
- Current viewer: `P:\Lexicon-Workspace\UML\Uml.Viewer`. The standalone `P:\Lexicon-Workspace\Uml.Viewer` is old.

## Current delivery boundary

Namespace-cable revision delivered: one directed cable per namespace pair, rounded coloured overview spines, ordered local collector rails, and compact socket banks spaced at 18 diagram units. Each bank has one **OUT** or **IN** label; its individual coloured sockets remain inspectable. Compatible branches reaching the same class share a port and final run. Original UML markers stay at class endpoints. Collapsed namespace summaries retain cable links; Separate mode has no overview cables. Extra container padding reserves rail space, and constrained member dragging respects it. Arrangement restore and older arrangement files remain supported.

At collapsed collection sockets, suppress UML terminal markers and multiplicities rather than stacking contradictory symbols; the inspector retains every original kind/annotation. Expanded class endpoints retain their markers. Cable `memberIds` are visible scene IDs for focus; `originalMemberIds` and `relationshipCount` preserve the original relationship count through collapsed proxies. Skip redundant arrangement rerouting when saved coordinates already match; explicit drag completion still repairs and reroutes once.

The built-in `examples/garage-vehicle-cables.uml.json` is a copy of the already generated cached Garage snapshot at commit `17dccad67c15168995d38148bda57cb59afc3a36`, not a live source read/write workflow. Focused geometry checks on its 29 nodes passed for custom inheritance and series-parallel (38 drawn edges plus 16 shortcuts; 24 external links become 5 cables and 10 sockets) and ELK with full interface lines (54 edges; 6 cables and 12 sockets). These three checks reported no routing warnings, card/header hits or immediate 180-degree folds. The small example's DOM checks passed cable inspection, Separate switching, arrangement restore and namespace collapse/re-expansion while preserving the source JSON. These results do not imply optimal routing or zero crossings for arbitrary graphs. Keep verification lightweight; no large new test suite.

Implemented: default containers with custom/ELK member layouts, responsive container placement, stable boundary gateways, compatible families, shared SVG segments, separate lanes, crossing halos, per-relationship inspection/focus, namespace collapse/search reveal, constrained member dragging, group dragging, pin-aware arrangement repair, undo/redo and backwards-compatible arrangement routing preferences. `src/model/containers.js`, `src/layout/containers.js`, `src/layout/routing/` and `src/rendering/core/connections.js` contain the new responsibilities.

Optional element `namespace` metadata creates namespace frames. Explicit groups keep their existing membership and meaning; group `kind: "namespace"` is optional metadata. Ungrouped objects without namespace data appear under **Unassigned / global**. Do not infer namespaces by splitting class names or treating arbitrary group names as facts. Interfaces remain in their own container; the old global interface shelf is only used in compact label mode.

Limitations: namespace containers are flat; explicit custom groups take precedence over generated namespace frames, so nested namespace/custom-group composition is not yet represented. Routing uses bounded heuristics, not a global optimum. Obstructed manual arrangements can produce a warning and require more room. Drag preview is lightweight; the completed network is rerouted on release. Series-parallel recognition applies within each container; unsupported local backbones use an explained hierarchical fallback. The best of two independently cloned container arrangements is chosen for the viewport; clone inputs because ELK mutates them. Cable overview geometry must not be mistaken for semantic relationship geometry when changing these modules.
