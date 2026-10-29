# UML

Human-editable JSON diagrams with a standalone, offline UML viewer.

## Open the workspace

- **VS Code:** open `UML.code-workspace`. Use **Terminal → Run Task** for preview, build, or tests.
- **Visual Studio:** open `UML.sln`. It contains the `Uml.Viewer` JavaScript project, with source, examples, schema, tests and documentation. Install Visual Studio's JavaScript/TypeScript development tools if prompted. The pinned JavaScript project SDK restores on first open. Build generates examples and schema; Start runs the local preview.
- **Use the viewer:** open `Uml.Viewer/index.html` in a browser. No installation or server is required. Choose an example or drag in a JSON diagram.

## Projects

| Project | Status | Responsibility |
| --- | --- | --- |
| `Uml.Viewer/` | Implemented | Validate JSON, lay out and render diagrams, control named collapsed/expanded states. |
| `Uml.Generator/` | Planned; not created yet | Extract code/story facts and produce JSON for human review and import. |

The viewer currently renders class, aggregation, component, sequence and communication diagrams. JSON describes content and relationships; each diagram type has its own renderer over a shared drawing foundation. Sequence and communication views can share one interaction.

## Development

Install Node.js 22+ and pnpm, then run:

```powershell
cd Uml.Viewer
pnpm install --frozen-lockfile
pnpm run build
pnpm test
pnpm start
```

Visual Studio uses explicit Node commands for build, preview and tests, following the [JavaScript project system settings](https://learn.microsoft.com/en-us/visualstudio/javascript/javascript-project-system-msbuild-reference?view=vs-2022). Automatic npm installation is disabled because this repository uses pnpm; install test dependencies with the command above.

Preview opens at `http://127.0.0.1:4173/`. If that port is already in use, stop the existing preview or set `UML_VIEWER_PORT` to another port. The server listens only on this computer. Opening `index.html` directly also works.

VS Code associates example and accepted diagram files with the local JSON Schema for editing suggestions. Keep personal documents out of Git unless you intend to share them.

- [Viewer instructions](Uml.Viewer/README.md)
- [JSON format and collapse names](Uml.Viewer/JSON-FORMAT.md)
- [Project plan](Uml.Viewer/PROJECT-PLAN.md)
- [Renderer architecture](Uml.Viewer/RENDERING-ARCHITECTURE.md)
- [Supported diagram types](Uml.Viewer/DIAGRAM-TYPES.md)
- [Bundled ELK license and provenance](Uml.Viewer/vendor/README.md)

The repository includes source, editable examples, generated example/schema assets, tests and the pinned development dependency lockfile. Dependencies, caches and editor-local state are ignored.
