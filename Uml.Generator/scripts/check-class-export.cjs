// Integration check against the actual viewer contract and renderer. Never reads source repositories.
const fs = require('node:fs');
const path = require('node:path');
const { setup, context, geometry } = require('../../Uml.Viewer/tests/helpers.cjs');
const viewer = setup();
async function main() {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error('Provide one or more generated .uml.json files.');
  for (const file of files) {
    const document = viewer.Contract.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    for (const view of document.views) {
      for (const expanded of [false, true]) {
        const state = context();
        if (expanded) for (const id of Object.keys(document.elements)) state.state.open.set(id, true);
        geometry(await viewer.Renderers.get(view.type).build(document, view, state));
      }
    }
    console.log(`Validated and rendered: ${document.id} (${Object.keys(document.elements).length} elements)`);
  }
}
main().catch(error => { console.error(error.path ? `${error.path}: ${error.message}` : error.message); process.exitCode = 1; });
