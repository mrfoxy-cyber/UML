const test=require('node:test'),assert=require('node:assert/strict');
const {setup,example,context,geometry,browser}=require('./helpers.cjs');const U=setup();
const linked=()=>example('garage-connected');

test('identified operations share one namespace with elements; duplicate owners and missing references fail',()=>{
  const collision=linked();collision.elements.garage.members[0].id='service';assert.throws(()=>U.Contract.validate(collision),/Duplicate shared ID/);
  const duplicate=linked();duplicate.elements.spot.members[0].id='garage.park';assert.throws(()=>U.Contract.validate(duplicate),/Duplicate shared ID/);
  const missing=linked();missing.activities.parking.nodes[1].references=['removed.operation'];assert.throws(()=>U.Contract.validate(missing),e=>e.path==='$.activities.parking.nodes[1].references[0]');
  const message=linked();message.interactions.parking.steps[0].references=['missing'];assert.throws(()=>U.Contract.validate(message),/Unknown shared object/);
});

test('activity edges and guards are validated within their activity scope',()=>{
  const missing=linked();missing.activities.parking.flows[0].to='gone';assert.throws(()=>U.Contract.validate(missing),/Unknown activity node/);
  const guard=linked();delete guard.activities.parking.flows.find(f=>f.from==='validate').guard;assert.throws(()=>U.Contract.validate(guard),/needs a guard/);
  const end=linked();end.activities.parking.flows.push({id:'illegal',from:'end',to:'start'});assert.throws(()=>U.Contract.validate(end),/Final nodes/);
  const view=linked();view.views.at(-1).activity='missing';assert.throws(()=>U.Contract.validate(view),/Reference an activity/);
});

test('one operation resolves across class, sequence, communication and activity with scoped occurrence IDs',()=>{
  const index=U.Connectivity.index(linked()),matches=U.Connectivity.matches(index,'garage.park');
  assert.deepEqual([...new Set(matches.direct.map(o=>o.type))].sort(),['activity','class','communication','sequence']);
  assert(matches.related.some(o=>o.kind==='element'&&o.localId==='garage'));
  const requests=index.occurrences.filter(o=>o.kind==='message'&&o.localId==='request');assert.equal(requests.length,4);assert.equal(new Set(requests.map(o=>o.key)).size,4);
  assert.equal(index.catalog.get('garage.park').owner,'garage');
});

test('renaming objects or labels preserves connectivity and repeated calls remain separate occurrences',()=>{
  const d=linked(),before=U.Connectivity.index(d).byObject.get('spot.fits').map(o=>o.key);
  d.elements.spot.name='Parking bay';d.elements.spot.members[0].name='Check size';d.interactions.parking.steps[3].branches[0].steps[1].label='Edited call';
  const index=U.Connectivity.index(d);assert.deepEqual(index.byObject.get('spot.fits').map(o=>o.key),before);
  assert.equal(index.byObject.get('spot.fits').filter(o=>o.type==='sequence'&&o.kind==='message').length,2);
});

test('all connected Garage views render valid geometry and activity decision guards remain visible',async()=>{
  const d=U.Contract.validate(linked());for(const v of d.views){const scene=await U.Renderers.get(v.type).build(d,v,context());geometry(scene);if(v.type==='activity'){assert(scene.nodes.some(n=>n.kind==='decision'));assert(scene.edges.some(e=>e.label==='[yes]'));assert(scene.edges.every(e=>e.points.length>=2));}}
});

test('activity connectors meet the diamond and initial/final symbol outlines',async()=>{
  const d=linked(),view=d.views.find(v=>v.type==='activity'),scene=await U.Renderers.get('activity').build(d,view,context());
  for(const edge of scene.edges)for(const [id,point] of [[edge.source,edge.points[0]],[edge.target,edge.points.at(-1)]]){
    const n=scene.nodes.find(n=>n.id===id),dx=point.x-n.x-n.width/2,dy=point.y-n.y-n.height/2;
    if(['decision','merge'].includes(n.kind))assert(Math.abs(Math.abs(dx)/(n.width/2)+Math.abs(dy)/(n.height/2)-1)<.001);
    if(['initial','final'].includes(n.kind))assert(Math.abs(Math.hypot(dx,dy)-(n.kind==='final'?13:11))<.001);
  }
});

test('member links navigate to actions and Back restores camera, expansion and selection exactly',async()=>{
  const {app,document}=await browser();await app.selectExample('garage-connected');
  await app.toggle('service',app.getState().document.elements.service);app.selectObject('service.park');app.zoom(1.3);
  const before=app.getState();const target=before.index.byObject.get('service.park').find(o=>o.type==='activity'&&o.localId==='request');
  const button=[...document.querySelectorAll('[data-occurrence-key]')].find(b=>b.dataset.occurrenceKey===target.key);assert(button);button.click();
  const {waitFor}=require('./helpers.cjs');await waitFor(()=>app.getState().view.id===target.viewId&&document.querySelector('[data-node-id="request"].is-selected'));
  assert.equal(app.getState().historyLength,1);assert.equal(app.getState().camera.zoom,1);
  assert(await app.back());const restored=app.getState();assert.equal(restored.view.id,before.view.id);assert.deepEqual(restored.camera,before.camera);assert.deepEqual([...restored.open],[...before.open]);assert.equal(restored.selection.objectId,'service.park');assert.equal(restored.historyLength,0);
});

test('jumping to a class member opens its group, renders its readable signature and highlights the row',async()=>{
  const {app,document}=await browser();await app.selectExample('garage-connected');await app.selectView('parking-activity');app.selectObject('garage.park');
  const occurrence=app.getState().index.byObject.get('garage.park').find(o=>o.type==='class');assert(await app.navigateTo(occurrence.key));
  assert.equal(app.getState().open.get('group:domain'),true);assert.equal(app.getState().open.get('garage'),true);
  const row=document.querySelector('[data-object-id="garage.park"]');assert(row.textContent.includes('+ Park(vehicle)'));assert(!row.textContent.includes('"id"'));assert(row.classList.contains('is-selected'));
});

test('jumping into an alternative reveals its parent frames and highlights the exact sequence message',async()=>{
  const {app,document}=await browser();await app.selectExample('garage-connected');app.selectObject('spot.park');
  const occurrence=app.getState().index.byObject.get('spot.park').find(o=>o.type==='sequence'&&o.kind==='message');assert(await app.navigateTo(occurrence.key));
  assert.equal(app.getState().open.get('fragment:parking:parking-result'),true);assert(app.getState().scene.edges.some(e=>e.message?.id==='assign'));
  assert(document.querySelector('[data-edge-id="message:assign"]').classList.contains('is-selected'));
});

test('communication navigation reveals grouped endpoints and highlights the connection holding the message',async()=>{
  const {app,document}=await browser();await app.selectExample('garage-connected');app.selectObject('spot.park');
  const occurrence=app.getState().index.byObject.get('spot.park').find(o=>o.type==='communication'&&o.kind==='message');await app.navigateTo(occurrence.key);
  assert(app.getState().scene.nodes.some(n=>n.id==='spot'));assert(document.querySelector('.edge-group.is-selected'));
});

test('activity reference buttons select shared objects and element buttons expose connected views',async()=>{
  const {app,document}=await browser();await app.selectExample('garage-connected');await app.selectView('parking-activity');
  document.querySelector('[data-node-id="request"] .node-connect').click();document.querySelector('[data-reference-id="service.park"]').click();
  assert.equal(app.getState().selection.objectId,'service.park');assert(document.querySelectorAll('.occurrence-link').length>3);
});

test('reimport replaces the lookup and history atomically; an invalid reference preserves the current document',async()=>{
  const {app}=await browser();await app.selectExample('garage-connected');app.selectObject('garage.park');await app.navigateTo(app.getState().index.byObject.get('garage.park').find(o=>o.type==='activity').key);
  const before=app.getState(),bad=linked();bad.activities.parking.nodes[1].references=['missing'];assert.equal(await app.loadText(JSON.stringify(bad)),false);assert.equal(app.getState().index,before.index);assert.equal(app.getState().historyLength,before.historyLength);
  await app.selectExample('garage-removal-linked');assert.equal(app.getState().historyLength,0);assert.equal(app.getState().selection,null);assert(!app.getState().index.occurrences.some(o=>o.viewId==='parking-sequence'));
});

test('navigation temporarily reveals fields hidden by JSON, and Reset restores the declared presentation',async()=>{
  const {app,document}=await browser(),d=linked();d.groups[0].display.expanded.show=['name'];d.elements.garage.display={expanded:{show:['name']}};
  d.interactions.parking.steps[3].display.expanded.show=['name','guards'];const raw=JSON.stringify(d);await app.loadText(raw);
  app.selectObject('garage.park');await app.navigateTo(app.getState().index.byObject.get('garage.park').find(o=>o.type==='class').key);assert(document.querySelector('[data-object-id="garage.park"]'));
  await app.navigateTo(app.getState().index.byObject.get('garage.park').find(o=>o.type==='sequence'&&o.kind==='message').key);assert(app.getState().scene.edges.some(e=>e.message?.id==='auto-park'));assert.equal(app.getState().raw,raw);
  document.getElementById('reset-button').click();const {waitFor}=require('./helpers.cjs');await waitFor(()=>app.getState().scene.edges.length===3);assert.equal(app.getState().raw,raw);
});
