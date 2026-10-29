# Generated drafts

The analysis command writes `analysis/<snapshot-identity>/analysis.json` here. These intermediate code facts are ignored by Git. Re-running replaces the report atomically. They are not yet diagram documents accepted by the viewer.

The class command writes viewer-ready diagrams, `provenance.json` and a readable `provenance.html` under `classes/<snapshot-identity>/<diagram-id>/<export-hash>/`. Open only `<diagram-id>.uml.json` in the viewer. Open `provenance.html` from File Explorer in a regular browser, or inspect raw provenance JSON in an editor. All three files are published together; changed drafts create a new directory. Accepted diagrams live in the viewer product.
