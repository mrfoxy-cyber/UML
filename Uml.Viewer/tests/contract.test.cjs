const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {setup,example,root}=require('./helpers.cjs');const U=setup();
test('all published examples satisfy the exact runtime schema and semantic references',()=>{for(const file of fs.readdirSync(path.join(root,'examples')).filter(f=>f.endsWith('.json')))assert(U.Contract.parse(fs.readFileSync(path.join(root,'examples',file),'utf8')));});
test('published JSON Schema matches the runtime contract',()=>assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'schema/uml-document.schema.json'),'utf8')),U.Contract.schema));
test('type errors distinguish absent, unknown and recognized-but-unsupported views',()=>{
  const d=example('garage-structure');delete d.views[0].type;assert.throws(()=>U.Contract.validate(d),/Declare a UML/);
  d.views[0].type='clas';assert.throws(()=>U.Contract.validate(d),/Unknown diagram/);
  d.views[0].type='timing';assert.throws(()=>U.Contract.validate(d),/recognized but/);
});
test('rejects invalid JSON, duplicate JSON properties, duplicate IDs and unknown fields',()=>{
  assert.throws(()=>U.Contract.parse('{'),/Invalid JSON/);assert.throws(()=>U.Contract.parse('{"version":1,"version":1}'),/Duplicate property/);
  const d=example('garage-structure');d.relationships.push({...d.relationships[0]});assert.throws(()=>U.Contract.validate(d),/Duplicate ID/);
  const typo=example('garage-structure');typo.elements.service.colour='red';assert.throws(()=>U.Contract.validate(typo),/Unknown field/);
});
test('reports the exact missing relationship reference',()=>{const d=example('garage-structure');d.relationships[0].to='missing';assert.throws(()=>U.Contract.validate(d),e=>e.path==='$.relationships[0].to'&&e.message.includes('missing'));});
test('group membership is explicit and flat',()=>{const d=example('garage-structure');d.groups.push({id:'second',name:'Second',members:['garage']});assert.throws(()=>U.Contract.validate(d),/already belongs/);});
test('rejects unsupported input versions and excessive depth/size',()=>{
  const d=example('garage-structure');d.version=2;assert.throws(()=>U.Contract.validate(d),/Version 2/);
  assert.throws(()=>U.Contract.parse('['.repeat(41)+']'.repeat(41)),/nested too deeply/);assert.throws(()=>U.Contract.parse(' '.repeat(4*1024*1024+1)),/too large/);
});
test('inheritance cycles and incorrect implementation endpoints fail clearly',()=>{
  const d=example('garage-structure');d.relationships=[{id:'a',kind:'inheritance',from:'service',to:'garage'},{id:'b',kind:'inheritance',from:'garage',to:'service'}];assert.throws(()=>U.Contract.validate(d),/cycle/);
  d.relationships=[{id:'a',kind:'implementation',from:'service',to:'garage'}];assert.throws(()=>U.Contract.validate(d),/interface/);
});
test('display states accept custom names and only appropriate visible fields',()=>{
  const d=example('garage-structure');assert(U.Contract.validate(d));d.elements.service.display.expanded.show=['steps'];assert.throws(()=>U.Contract.validate(d),/not a display field/);
});
test('interaction messages must reference participants and unique step IDs',()=>{
  const d=example('parking-success');d.interactions['park-vehicle'].steps[0].to='missing';assert.throws(()=>U.Contract.validate(d),/not a participant/);
  const duplicate=example('parking-alternatives');duplicate.interactions.parking.steps[1].branches[0].steps[0].id='request';assert.throws(()=>U.Contract.validate(duplicate),/Duplicate step ID/);
});
test('type-specific view selection rejects the wrong model kind',()=>{const d=example('garage-structure');d.views[0].type='component';assert.throws(()=>U.Contract.validate(d),/cannot contain/);});
test('editor schema hint is accepted without fetching it',()=>{const d=example('garage-structure');d.$schema='../schema/uml-document.schema.json';assert(U.Contract.validate(d));});
