const test=require('node:test'),assert=require('node:assert/strict');
const {browser,waitFor,example}=require('./helpers.cjs');

test('type groups reveal named diagrams without changing the active diagram until one is selected',async()=>{
  const {app,document}=await browser();await app.selectExample('garage-connected');
  const group=document.querySelector('[data-diagram-type="sequence"]');assert.equal(group.querySelector('.nav-type-count').textContent,'2');assert(group.querySelector('.nav-type-items').hidden);
  group.querySelector('button').click();assert.equal(app.getState().view.id,'model');assert(!document.getElementById('nav-type-sequence').hidden);
  const diagram=document.querySelector('[data-view-id="removal-sequence"]');assert(diagram.textContent.includes('Garage · removal conversation'));assert(diagram.textContent.includes('removal-sequence'));diagram.click();
  await waitFor(()=>app.getState().scene.interaction?.id==='removal');assert.equal(document.getElementById('view-title').textContent,'Garage · removal conversation');assert.equal(document.getElementById('view-id').textContent,'removal-sequence');assert.equal(document.querySelector('[aria-current="page"]').dataset.viewId,'removal-sequence');
});

test('duplicate diagram titles stay distinguishable by ID and type groups retain their open state',async()=>{
  const {app,document}=await browser(),d=example('garage-connected');d.views.filter(v=>v.type==='sequence').forEach(v=>v.title='Garage action');await app.loadText(JSON.stringify(d));
  document.querySelector('[data-type-toggle="sequence"]').click();assert(document.querySelector('[data-view-id="parking-sequence"]').textContent.includes('parking-sequence'));assert(document.querySelector('[data-view-id="removal-sequence"]').textContent.includes('removal-sequence'));
  await app.selectView('parking-activity');assert(!document.getElementById('nav-type-sequence').hidden);assert(!document.getElementById('nav-type-activity').hidden);assert.equal(document.getElementById('view-id').textContent,'parking-activity');
});

test('cross-view jumps open the destination type group and Back identifies the original diagram',async()=>{
  const {app,document}=await browser();await app.selectExample('garage-connected');app.selectObject('garage.park');assert(document.getElementById('nav-type-activity').hidden);
  const occurrence=app.getState().index.byObject.get('garage.park').find(o=>o.type==='activity');await app.navigateTo(occurrence.key);assert(!document.getElementById('nav-type-activity').hidden);assert.equal(document.getElementById('view-id').textContent,occurrence.viewId);
  await app.back();assert.equal(document.getElementById('view-id').textContent,'model');assert(document.querySelector('[data-diagram-type="class"]').classList.contains('is-current'));
});
