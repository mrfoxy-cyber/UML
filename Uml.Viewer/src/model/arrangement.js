(function(root){
  'use strict';const U=root.UmlViewer ||= {},algorithms=['inheritance','series-parallel','elk'];
  const copyMap=map=>new Map([...map].map(([id,value])=>[id,{...value}]));
  function ensure(state){state.positions ||= new Map();state.groupOffsets ||= new Map();state.layoutUndo ||= [];state.layoutRedo ||= [];state.layoutAlgorithm ||= 'elk';state.layoutDirection ||= 'DOWN';state.routingMode ||= 'bundled';return state;}
  function snapshot(state){ensure(state);return {positions:copyMap(state.positions),groupOffsets:copyMap(state.groupOffsets),open:new Map(state.open),layoutAlgorithm:state.layoutAlgorithm,layoutDirection:state.layoutDirection,groupLayout:state.groupLayout,interfacesAsLines:state.interfacesAsLines,routingMode:state.routingMode};}
  function restore(state,value){state.positions=copyMap(value.positions);state.groupOffsets=copyMap(value.groupOffsets);state.open=new Map(value.open);for(const key of ['layoutAlgorithm','layoutDirection','groupLayout','interfacesAsLines','routingMode'])state[key]=value[key];}
  function checkpoint(state,before){ensure(state);state.layoutUndo.push(before);if(state.layoutUndo.length>50)state.layoutUndo.shift();state.layoutRedo=[];}
  function undo(state){ensure(state);if(!state.layoutUndo.length)return false;state.layoutRedo.push(snapshot(state));restore(state,state.layoutUndo.pop());return true;}
  function redo(state){ensure(state);if(!state.layoutRedo.length)return false;state.layoutUndo.push(snapshot(state));restore(state,state.layoutRedo.pop());return true;}
  const overlaps=(a,b,gap=12)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
  function reframe(scene){
    if(scene.coordinated)return U.Containers.reframe(scene);
    for(const group of scene.groups){const children=scene.nodes.filter(n=>n.groupId===group.id);if(!children.length)continue;group.x=Math.max(0,Math.min(...children.map(n=>n.x))-24);group.y=Math.max(0,Math.min(...children.map(n=>n.y))-60-(group.noteHeight||0));group.width=Math.max(...children.map(n=>n.x+n.width))+24-group.x;group.height=Math.max(...children.map(n=>n.y+n.height))+24-group.y;}
    scene.width=Math.max(600,...scene.nodes.map(n=>n.x+n.width+36),...scene.groups.map(g=>g.x+g.width+36));scene.height=Math.max(300,...scene.nodes.map(n=>n.y+n.height+36),...scene.groups.map(g=>g.y+g.height+36));return scene;
  }
  function capture(scene,state){ensure(state);for(const node of scene.nodes){const old=state.positions.get(node.id);state.positions.set(node.id,{x:node.x,y:node.y,pinned:old?.pinned||false});node.pinned=old?.pinned||false;}}
  function apply(scene,state,{repair=false}={}){
    ensure(state);let moved=repair;
    for(const node of scene.nodes){const before={x:node.x,y:node.y},position=state.positions.get(node.id),group=(node.groupId||node.sourceGroupId||'').replace(/^frame:/,''),offset=state.groupOffsets.get(group);if(position){node.x=position.x;node.y=position.y;}else if(offset){node.x+=offset.dx;node.y+=offset.dy;}if(Math.abs(node.x-before.x)>.05||Math.abs(node.y-before.y)>.05)moved=true;node.pinned=position?.pinned||false;}
    if(moved){
      const placed=scene.nodes.filter(n=>n.pinned);
      for(const node of scene.nodes.filter(n=>!n.pinned)){let attempts=0,hit;while((hit=placed.find(other=>overlaps(node,other)))&&attempts++<200)node.y=hit.y+hit.height+24;placed.push(node);}
      reframe(scene);if(scene.coordinated)U.Containers.settle(scene);U.EdgeRouter.scene(scene);
    }
    capture(scene,state);return scene;
  }
  function auto(state){ensure(state);state.positions=new Map([...state.positions].filter(([,position])=>position.pinned));}
  function reset(state){ensure(state);state.positions.clear();state.groupOffsets.clear();}
  function pin(scene,state,id){ensure(state);capture(scene,state);const node=scene.nodes.find(n=>n.id===id);if(!node)return;const position=state.positions.get(id);position.pinned=!position.pinned;node.pinned=position.pinned;}
  function groupPin(scene,state,id){const group=scene.groups.find(g=>g.sourceId===id);if(!group)return;capture(scene,state);const children=scene.nodes.filter(n=>n.groupId===group.id),pin=!children.every(n=>state.positions.get(n.id)?.pinned);for(const node of children){state.positions.get(node.id).pinned=pin;node.pinned=pin;}if(!pin)state.groupOffsets.delete(id);if(state.positions.has('group:'+id))state.positions.get('group:'+id).pinned=pin;}
  function serialize(document,view,state,camera){
    ensure(state);return {kind:'uml-arrangement',version:1,documentId:document.id,diagramId:view.id,layout:state.layoutAlgorithm,direction:state.layoutDirection,groupLayout:state.groupLayout!==false,interfacesAsLines:!!state.interfacesAsLines,routingMode:state.routingMode,nodes:Object.fromEntries([...state.positions].sort(([a],[b])=>a.localeCompare(b))),groups:Object.fromEntries([...state.groupOffsets].sort(([a],[b])=>a.localeCompare(b))),expanded:Object.fromEntries([...state.open].sort(([a],[b])=>a.localeCompare(b))),camera:{...camera}};
  }
  function parse(raw,document,view){
    if(typeof raw!=='string'||raw.length>1024*1024)throw new Error('Maximum arrangement size is 1 MB.');
    const value=JSON.parse(raw),object=v=>v&&typeof v==='object'&&!Array.isArray(v),finite=(n,limit=100000)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=limit;
    if(!object(value)||value.kind!=='uml-arrangement'||value.version!==1)throw new Error('Choose a version 1 UML arrangement file.');
    const allowed=['kind','version','documentId','diagramId','layout','direction','groupLayout','interfacesAsLines','routingMode','nodes','groups','expanded','camera'];
    if(Object.keys(value).some(key=>!allowed.includes(key)))throw new Error('Unknown arrangement field.');
    if(value.diagramId!==view.id||value.documentId!==document.id)throw new Error('This arrangement belongs to another document or diagram. Open its diagram first.');
    if(!algorithms.includes(value.layout)||!['DOWN','RIGHT'].includes(value.direction))throw new Error('Unsupported arrangement layout or direction.');
    if(typeof value.groupLayout!=='boolean'||typeof value.interfacesAsLines!=='boolean')throw new Error('Invalid arrangement presentation options.');
    if(value.routingMode!==undefined&&!['bundled','separate'].includes(value.routingMode))throw new Error('Invalid connection presentation.');
    const ids=new Set(view.elements||[]),groups=new Set((U.Containers?U.Containers.document(document,view).groups:document.groups||[]).filter(g=>g.members.some(id=>ids.has(id))).map(g=>g.id));
    for(const id of groups)ids.add('group:'+id);
    const positions=new Map(),offsets=new Map(),open=new Map();let ignored=0;
    for(const [field,maximum] of [['nodes',200],['groups',50],['expanded',250]])if(!object(value[field])||Object.keys(value[field]).length>maximum)throw new Error('Invalid or excessive arrangement '+field+'.');
    for(const [id,p] of Object.entries(value.nodes)){
      if(!object(p)||Object.keys(p).some(key=>!['x','y','pinned'].includes(key))||!finite(p.x)||!finite(p.y)||p.x<0||p.y<0||typeof p.pinned!=='boolean')throw new Error('Invalid card position in arrangement.');
      if(ids.has(id))positions.set(id,{x:p.x,y:p.y,pinned:p.pinned});else ignored++;
    }
    for(const [id,p] of Object.entries(value.groups)){
      if(!object(p)||Object.keys(p).some(key=>!['dx','dy'].includes(key))||!finite(p.dx)||!finite(p.dy))throw new Error('Invalid group offset in arrangement.');
      if(groups.has(id))offsets.set(id,{dx:p.dx,dy:p.dy});else ignored++;
    }
    for(const [id,expanded] of Object.entries(value.expanded)){if(typeof expanded!=='boolean')throw new Error('Invalid collapse state in arrangement.');if(ids.has(id))open.set(id,expanded);else ignored++;}
    let camera=null;if(value.camera!==undefined){const c=value.camera;if(!object(c)||!finite(c.x,1000000)||!finite(c.y,1000000)||!finite(c.zoom)||c.zoom<.06||c.zoom>3)throw new Error('Invalid arrangement camera.');camera={x:c.x,y:c.y,zoom:c.zoom};}
    return {state:{positions,groupOffsets:offsets,open,layoutAlgorithm:value.layout,layoutDirection:value.direction,groupLayout:value.groupLayout,interfacesAsLines:value.interfacesAsLines,routingMode:value.routingMode||'bundled'},camera,ignored};
  }
  U.Arrangement={ensure,snapshot,restore,checkpoint,undo,redo,apply,capture,reframe,auto,reset,pin,groupPin,serialize,parse};
  if(typeof module==='object'&&module.exports)module.exports=U.Arrangement;
})(globalThis);
