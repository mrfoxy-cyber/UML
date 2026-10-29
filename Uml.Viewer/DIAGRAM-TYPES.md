# UML diagram types

Status: class, aggregation, component, sequence, communication and activity are implemented. The schema and importer validate those types. Other catalogue entries are recognized but unsupported.

Every entry in `views` requires a `type`. This identifies the UML diagram, determines how its input is interpreted and selects its symbols and layout. The title remains a human-readable name for that particular view.

For example, the shared interaction example requests two types:

```json
{
  "views": [
    {
      "id": "parking-sequence",
      "type": "sequence",
      "title": "Parking sequence",
      "interaction": "park-vehicle"
    },
    {
      "id": "parking-communication",
      "type": "communication",
      "title": "Parking collaboration",
      "interaction": "park-vehicle"
    }
  ]
}
```

This snippet shows the view section; the full self-contained document also defines the elements and interaction. Both views refer to the same messages. The document itself has no single diagram type because it can contain several views.

## Proposed names and staged support

These names form the catalogue. Class, aggregation, component, sequence, communication and activity are available now. Other types produce an explicit unsupported-type error when imported.

| JSON `type` | Display label | Category | Planned delivery |
| --- | --- | --- | --- |
| `class` | Class diagram | Structural | Implemented |
| `aggregation` | Aggregation diagram | Structural preset | Implemented; dedicated whole–part arrangement |
| `component` | Component diagram | Structural | Implemented |
| `sequence` | Sequence diagram | Interaction | Implemented |
| `communication` | Communication diagram | Interaction | Implemented |
| `object` | Object diagram | Structural | Later |
| `package` | Package diagram | Structural | Later |
| `composite-structure` | Composite structure diagram | Structural | Later |
| `deployment` | Deployment diagram | Structural | Later |
| `profile` | Profile diagram | Structural | Later |
| `use-case` | Use-case diagram | Behavioral | Later |
| `activity` | Activity diagram | Behavioral | Implemented: actions, decisions, merges, initial/final, guarded flows |
| `state-machine` | State-machine diagram | Behavioral | Later |
| `interaction-overview` | Interaction overview diagram | Interaction | Later |
| `timing` | Timing diagram | Interaction | Later; explicit time data required |

Interaction diagrams are behavioral UML diagrams, presented as a separate category for navigation.

`aggregation` is an explicit viewer type requested for whole–part examples, including the bicycle assignment. Its dedicated renderer reuses class shapes and UML markers while choosing its own whole–part arrangement. It displays the selected elements with their `kind: "aggregation"` relationships. The hollow diamond appears at the relationship's `from` end, representing the whole. Other relationship kinds remain available to a normal class view. This preset extends the viewer's choices without adding another official UML diagram category. An aggregation view with no matching relationships shows a clear empty state; it does not invent connections.

Every supported type receives a dedicated renderer module registered under its JSON name. The modules share the canvas, theme, text measurement and drawing primitives, while each owns its layout, shapes, label placement and detail presentation. See [rendering architecture](RENDERING-ARCHITECTURE.md) for the visual rules for each type.

## Validation and display rules

- Require `type` on each view. A title such as "Parking sequence" does not substitute for the field.
- Report a missing type, a misspelled/unknown type and a recognized-but-unsupported type as different problems.
- Check that the view references appropriate input: structural views select elements; sequence and communication select an interaction.
- Keep the last valid document visible if a new import fails validation. Do not silently omit unsupported views.
- Show the friendly type label in the diagram header and navigation. For example: **Sequence diagram · Parking sequence**.
- Keep `type` independent of visual themes. Changing colors does not change the UML type.
- Keep view `type` separate from element or relationship `kind`. For example, a `class` view can contain a relationship whose `kind` is `dependency`.

The [structural example](examples/garage-structure.uml.json) already declares `type: "class"`. The [interaction example](examples/parking-success.uml.json) declares `sequence` and `communication` views.
The [bicycle example](examples/bicycle-aggregation.uml.json) declares `type: "aggregation"`.
