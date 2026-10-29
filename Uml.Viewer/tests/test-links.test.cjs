const test=require('node:test'),assert=require('node:assert/strict');
const {setup,example,browser}=require('./helpers.cjs');const U=setup();

test('test links can be omitted, null or empty; legacy documents need no catalogue',()=>{
  for(const value of [null,[]]){const d=example('garage-structure');d.elements.garage.tests=value;d.views[0].tests=value;d.tests=null;assert(U.Contract.validate(d));}
  assert(U.Contract.validate(example('parking-success')));
});

test('unknown test references fail at their owner and duplicate links or unsafe URLs are rejected',()=>{
  const d=example('garage-connected');d.elements.garage.tests=['missing'];assert.throws(()=>U.Contract.validate(d),e=>e.path==='$.elements.garage.tests[0]');
  const flow=example('garage-connected');flow.activities.parking.flows[0].tests=['gone'];assert.throws(()=>U.Contract.validate(flow),e=>e.path==='$.activities.parking.flows[0].tests[0]');
  const duplicate=example('garage-connected');duplicate.views[0].tests=['garage.parking-suite','garage.parking-suite'];assert.throws(()=>U.Contract.validate(duplicate));
  for(const url of ['javascript:alert(1)','file:///C:/test','http://example.com/test']){const d=example('garage-connected');d.tests['garage.parking-suite'].url=url;assert.throws(()=>U.Contract.validate(d),/HTTPS URL/);}
});

test('class and method inspection show their own linked tests, while null shows no tests linked',async()=>{
  const {app,document}=await browser();await app.selectExample('garage-connected');app.selectObject('garage');let panel=document.getElementById('inspector-content');assert(panel.querySelector('[data-test-id="garage.parking-suite"]'));assert(panel.querySelector('[data-test-id="garage.removal-suite"]'));
  app.selectObject('garage.park');assert(panel.querySelector('[data-test-id="garage.park-success"]'));assert(panel.textContent.includes('Park_AddsVehicleAndUpdatesSpaceCounts'));assert(panel.textContent.includes('Garage.Tests/GarageParkingTests.cs'));
  app.selectObject('spot');assert(panel.textContent.includes('No tests linked.'));assert.equal(panel.querySelector('[data-test-id]'),null);
});

test('diagram and activity tests are separated from step tests and counted without duplicates',async()=>{
  const {app,document}=await browser();await app.selectExample('garage-connected');await app.selectView('parking-activity');assert.equal(document.getElementById('tests-button').textContent,'Tests · 3');document.getElementById('tests-button').click();const panel=document.getElementById('inspector-content');assert(panel.textContent.includes('Diagram tests'));assert(panel.textContent.includes('Activity tests'));assert(panel.querySelector('[data-test-id="garage.move-workflow"]'));
  document.querySelector('[data-node-id="available"] .node-connect').click();assert(panel.querySelector('[data-test-id="garage.park-full"]'));assert(panel.querySelector('[data-test-id="garage.park-success"]'));
  document.querySelector('[data-edge-id="flow:full"]').dispatchEvent(new (document.defaultView.Event)('click'));assert(panel.querySelector('[data-test-id="garage.park-full"]'));assert.equal(panel.querySelectorAll('[data-test-id]').length,1);
  document.querySelector('[data-node-id="assign"] .node-connect').click();assert(panel.textContent.includes('No tests linked.'));assert.equal(panel.querySelectorAll('[data-test-id]').length,0);
});

test('test names remain plain text and external links are explicit HTTPS references',async()=>{
  const {app,document}=await browser(),d=example('garage-connected');d.tests['garage.parking-suite'].name='<img src=x onerror=alert(1)>';await app.loadText(JSON.stringify(d));app.selectObject('garage');const entry=document.querySelector('[data-test-id="garage.parking-suite"]');assert(entry.textContent.includes('<img'));assert.equal(entry.querySelector('img'),null);assert(entry.querySelector('a').href.startsWith('https://'));assert.equal(entry.querySelector('a').target,'_blank');
});
