const test=require('node:test'),assert=require('node:assert/strict');const {setup,example,context,geometry}=require('./helpers.cjs');const U=setup();
test('six explicit renderer modules are registered',()=>assert.deepEqual(U.Renderers.types().sort(),U.Contract.SUPPORTED.slice().sort()));
test('all examples render finite, non-overlapping scenes in every declared view',async()=>{for(const name of ['garage-structure','bicycle-aggregation','components','parking-success','parking-alternatives']){const d=U.Contract.validate(example(name));for(const view of d.views)geometry(await U.Renderers.get(view.type).build(d,view,context()));}});
test('named element states control the actual visible fields',()=>{
  const d=example('garage-structure'),state={open:new Map()},item=d.elements.service;
  let p=U.Model.presentation(item,'service',state);assert.equal(p.name,'Garage service');assert(!p.show.has('members'));
  state.open.set('service',true);p=U.Model.presentation(item,'service',state);assert.equal(p.name,'GarageService · operations');assert(p.show.has('members'));assert(p.show.has('notes'));
});
test('group collapse uses its custom summary, hides internal links and preserves original endpoints',()=>{
  const d=example('garage-structure'),state={open:new Map([['group:domain',false]])};
  const collapsed=U.Model.structural(d,d.views[0],state);assert.equal(collapsed.nodes.length,1);assert.equal(collapsed.nodes[0].presentation.name,'Domain overview');assert.equal(collapsed.edges.length,0);
  const components=example('components');const grouped=U.Model.structural(components,components.views[0],{open:new Map()});const proxy=grouped.edges.find(e=>e.proxy);assert.equal(proxy.originals.length,2);assert.deepEqual(proxy.originals.map(e=>e.to),['catalog','payment']);
});
test('expanded groups retain children within their layout frame',async()=>{const d=example('garage-structure'),s=await U.Renderers.get('class').build(d,d.views[0],context());const g=s.groups[0];for(const n of s.nodes){assert(n.x>=g.x&&n.y>=g.y+45&&n.x+n.width<=g.x+g.width+.1&&n.y+n.height<=g.y+g.height+.1);}});
test('compound graph connectors terminate at the visible source and target borders',async()=>{
  for(const name of ['garage-structure','components']){const d=example(name),s=await U.Renderers.get(d.views[0].type).build(d,d.views[0],context());
    for(const e of s.edges)for(const [id,p] of [[e.source,e.points[0]],[e.target,e.points.at(-1)]]){const n=s.nodes.find(n=>n.id===id);const distance=Math.min(Math.abs(p.x-n.x),Math.abs(p.x-n.x-n.width),Math.abs(p.y-n.y),Math.abs(p.y-n.y-n.height));assert(distance<2,`${name} ${id}: endpoint is ${distance} away`);}
  }
});
test('inheritance ranks parent above child while keeping the original semantic direction',async()=>{
  const d={version:1,id:'inheritance',title:'Boats',elements:{boat:{kind:'class',name:'Boat'},sail:{kind:'class',name:'Sailboat'}},relationships:[{id:'inherits',kind:'inheritance',from:'sail',to:'boat'}],views:[{id:'boats',type:'class',title:'Boats',elements:['boat','sail']}]};
  U.Contract.validate(d);const s=await U.Renderers.get('class').build(d,d.views[0],context());assert(s.nodes.find(n=>n.id==='boat').y<s.nodes.find(n=>n.id==='sail').y);assert.equal(s.edges[0].source,'sail');assert.equal(s.edges[0].target,'boat');
});
test('aggregation emphasizes the whole, filters relationships and keeps the diamond endpoint',async()=>{const d=example('bicycle-aggregation'),s=await U.Renderers.get('aggregation').build(d,d.views[0],context());assert(s.nodes.find(n=>n.id==='bicycle').emphasis);assert(s.edges.every(e=>e.source==='bicycle'&&e.kind==='aggregation'));});
test('sequence and communication preserve the same canonical messages and guard contexts',async()=>{
  const d=example('parking-alternatives'),c=context(),seq=await U.Renderers.get('sequence').build(d,d.views[0],c),comm=await U.Renderers.get('communication').build(d,d.views[1],context());
  assert.deepEqual(seq.interaction.messages,comm.interaction.messages);assert.equal(seq.groups[0].presentation.name,'Parking outcome');assert.equal(seq.edges.length,1);
  c.state.open.set('fragment:parking:outcome',true);const expanded=await U.Renderers.get('sequence').build(d,d.views[0],c);geometry(expanded);assert.equal(expanded.edges.length,seq.interaction.messages.length);assert.equal(expanded.labels.length,2);
  const all=comm.edges.flatMap(e=>e.messages);assert.deepEqual(all.map(m=>m.id).sort(),seq.interaction.messages.map(m=>m.id).sort());assert(all.some(m=>m.guards.includes('The garage is full')));
});
test('a manual call edit changes both interaction views',async()=>{const d=example('parking-success');d.interactions['park-vehicle'].steps[0].label='RequestParking()';for(const v of d.views){const s=await U.Renderers.get(v.type).build(d,v,context());assert(s.interaction.messages.some(m=>m.label==='RequestParking()'));}});
test('expanding long detail lists preserves node separation and bounded scroll compartments',async()=>{const d=example('garage-structure');d.elements.service.members=Array.from({length:100},(_,i)=>'Operation '+i+' with a deliberately long explanatory label');const c=context();c.state.open.set('service',true);const s=await U.Renderers.get('class').build(d,d.views[0],c);geometry(s);const n=s.nodes.find(n=>n.id==='service');assert(n.height<650);assert.equal(n.rows.filter(r=>!r.muted).length,100);});
