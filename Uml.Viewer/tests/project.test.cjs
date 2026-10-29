const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {setup,root,browser,example}=require('./helpers.cjs');const U=setup();
const sources=()=>new Map(fs.readdirSync(path.join(root,'diagrams/garage-project')).filter(f=>f.endsWith('.json')).map(f=>[f,fs.readFileSync(path.join(root,'diagrams/garage-project',f),'utf8')]));
const files=map=>[...map].map(([name,text])=>({name,webkitRelativePath:'garage-project/'+name,size:text.length,text:async()=>text}));
function change(map,name,edit){const value=JSON.parse(map.get(name));edit(value);map.set(name,JSON.stringify(value));}

test('project merges one shared catalogue and separate scenario files into connected views',()=>{
  const input=sources(),project=U.Project.assemble(input,'uml.project.json');assert.equal(project.document.views.length,7);assert.equal(project.sources.size,5);
  const index=U.Connectivity.index(project.document);assert(index.byObject.get('garage.remove').some(o=>o.type==='activity'));assert(index.byObject.get('garage.remove').some(o=>o.type==='sequence'));
  for(const [name,text] of project.sources)assert.equal(text,input.get(name));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'schema/uml-project.schema.json'),'utf8')),U.Project.schema);
});

test('missing files, conflicting definitions and duplicate view IDs fail without silently merging',()=>{
  const missing=sources();missing.delete('parking.json');assert.throws(()=>U.Project.assemble(missing,'uml.project.json'),/file is missing/);
  const conflict=sources();change(conflict,'removal.json',d=>d.interactions.parking=JSON.parse(conflict.get('parking.json')).interactions.parking);assert.throws(()=>U.Project.assemble(conflict,'uml.project.json'),/Conflicting definition/);
  const view=sources();change(view,'removal.json',d=>d.views[0].id='model');assert.throws(()=>U.Project.assemble(view,'uml.project.json'),/Duplicate view ID/);
  const member=sources();change(member,'model.json',d=>d.elements.spot.members[0].id='garage.remove');assert.throws(()=>U.Project.assemble(member,'uml.project.json'),/Duplicate shared ID/);
});

test('project paths remain inside the chosen folder and source fields are strictly validated',()=>{
  for(const model of ['../outside.json','https://example.com/model.json','/model.json','folder/../model.json','C:\\model.json']){const map=sources();change(map,'uml.project.json',d=>d.model=model);assert.throws(()=>U.Project.assemble(map,'uml.project.json'),/relative .json path/);}
  const extra=sources();change(extra,'model.json',d=>d.script='run()');assert.throws(()=>U.Project.assemble(extra,'uml.project.json'),/Unknown field/);
  const duplicate=sources();duplicate.set('parking.json','{"views":[],"views":[]}');assert.throws(()=>U.Project.assemble(duplicate,'uml.project.json'),/Duplicate property/);
});

test('folder import navigates across files, preserves originals and exports a valid combined document',async()=>{
  const {app,document}=await browser(),input=sources();assert(await app.loadProject(files(input)));assert(!document.getElementById('source-file').hidden);
  assert(U.Contract.parse(app.getState().raw));assert.equal(app.getState().project.sources.get('garage-project/model.json'),input.get('model.json'));
  app.selectObject('spot.clear');const target=app.getState().index.byObject.get('spot.clear').find(o=>o.type==='activity');assert(await app.navigateTo(target.key));assert.equal(app.getState().view.id,'removal-activity');assert(await app.back());
});

test('bad or oversized folder imports preserve the active document; newer imports beat slow folder reads',async()=>{
  const {app}=await browser();await app.selectExample('garage-connected');const before=app.getState();const missing=sources();missing.delete('model.json');assert.equal(await app.loadProject(files(missing)),false);assert.equal(app.getState().document,before.document);
  assert.equal(await app.loadProject([{name:'huge.json',size:5*1024*1024}]),false);assert.equal(app.getState().document,before.document);
  let release;const slow=files(sources());slow[0].text=()=>new Promise(resolve=>release=()=>resolve(sources().get(slow[0].name)));
  const pending=app.loadProject(slow);await app.loadText(JSON.stringify(example('bicycle-aggregation')),'newer.json');release();assert.equal(await pending,false);assert.equal(app.getState().filename,'newer.json');
});
