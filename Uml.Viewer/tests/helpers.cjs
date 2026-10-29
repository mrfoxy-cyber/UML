const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const scripts=['src/validation/contract.js','src/model/model.js','src/rendering/registry.js','src/rendering/core/measure.js','src/layout/graph.js','src/rendering/types/class.js','src/rendering/types/aggregation.js','src/rendering/types/component.js','src/rendering/types/sequence.js','src/rendering/types/communication.js'];
function setup(){for(const file of scripts)require(path.join(root,file));return globalThis.UmlViewer;}
function example(name){return JSON.parse(fs.readFileSync(path.join(root,'examples',name+'.uml.json'),'utf8'));}
function context(){const ELK=require('../vendor/elk.bundled.js');return {elk:new ELK(),measure:(text,size=13)=>[...String(text)].length*size*.55,state:{open:new Map()},viewport:{width:1100,height:650}};}
function geometry(scene){
  assert(Number.isFinite(scene.width)&&scene.width>0);assert(Number.isFinite(scene.height)&&scene.height>0);
  for(const node of scene.nodes)for(const key of ['x','y','width','height'])assert(Number.isFinite(node[key]),node.id+' '+key);
  for(let i=0;i<scene.nodes.length;i++)for(let j=i+1;j<scene.nodes.length;j++){const a=scene.nodes[i],b=scene.nodes[j];assert(!(a.x<b.x+b.width-.2&&a.x+a.width>b.x+.2&&a.y<b.y+b.height-.2&&a.y+a.height>b.y+.2),'Overlapping nodes: '+a.id+' / '+b.id);}
  for(const edge of scene.edges){assert(edge.points.length>=2);for(const p of edge.points)assert(Number.isFinite(p.x)&&Number.isFinite(p.y));}
}
async function waitFor(condition){for(let n=0;n<500;n++){if(condition())return;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out waiting for viewer');}
async function browser(){
  const vm=require('node:vm'),{parseHTML}=require('linkedom');
  const {window}=parseHTML(fs.readFileSync(path.join(root,'index.html'),'utf8')),document=window.document,viewport=document.getElementById('viewport');
  Object.defineProperties(viewport,{clientWidth:{value:1100,writable:true},clientHeight:{value:650,writable:true}});viewport.getBoundingClientRect=()=>({left:0,top:0,width:viewport.clientWidth,height:viewport.clientHeight});viewport.setPointerCapture=()=>{};
  let focused=null;Object.defineProperty(document,'activeElement',{get:()=>focused});window.HTMLElement.prototype.focus=function(){focused=this;};
  const sandbox={document,console,setTimeout,clearTimeout,URL,Blob,requestAnimationFrame:f=>setTimeout(f,0),cancelAnimationFrame:clearTimeout,localStorage:{getItem(){return null;},setItem(){}},addEventListener(){}};
  sandbox.window=sandbox;const scope=vm.createContext(sandbox);
  for(const script of document.querySelectorAll('script[src]'))vm.runInContext(fs.readFileSync(path.join(root,script.getAttribute('src')),'utf8'),scope,{filename:script.getAttribute('src')});
  await waitFor(()=>scope.UmlViewer.App.getState().scene);
  return {document,window,scope,app:scope.UmlViewer.App,viewport};
}
module.exports={root,setup,example,context,geometry,browser,waitFor};
