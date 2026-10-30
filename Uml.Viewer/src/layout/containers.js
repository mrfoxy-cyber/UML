(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  async function layout(data,context,algorithm){
    if(context.state.groupLayout===false){const names=new Map(data.groups.map(g=>[g.id,g.item.name])),flat={...data,groups:[],nodes:data.nodes.map(n=>({...n,namespace:names.get(n.groupId),sourceGroupId:n.groupId,groupId:null}))};let scene=algorithm==='elk'?null:U.StructuredLayout.layout(flat,{...context,deferRouting:true},algorithm);if(!scene)scene=await U.GraphLayout(flat,context,{direction:context.state.layoutDirection||'DOWN',inheritanceUp:true,nodeGap:60,layerGap:100});scene.layoutInfo ||= {applied:'elk',basis:'hierarchical members'};return scene;}
    const tiles=[],hints=new Map(),measured=new Map(data.nodes.map(n=>[n.id,U.Measure.node(n,context)]));let fallback=false;
    const groups=[...data.groups].sort((a,b)=>data.edges.filter(e=>measured.get(e.source)?.groupId===b.id&&e.kind==='inheritance').length-data.edges.filter(e=>measured.get(e.source)?.groupId===a.id&&e.kind==='inheritance').length||b.count-a.count||a.id.localeCompare(b.id));
    for(const group of groups){
      group.noteHeight=group.presentation.show.has('notes')&&group.item.notes?Math.min(110,U.Measure.wrap(group.item.notes,280,context.measure,12).length*18+8):0;
      const members=data.nodes.filter(n=>n.groupId===group.id),ids=new Set(members.map(n=>n.id));
      for(const node of members){const neighbors=data.edges.filter(e=>e.source===node.id||e.target===node.id).map(e=>hints.get(e.source===node.id?e.target:e.source)).filter(Number.isFinite);if(neighbors.length)hints.set(node.id,neighbors.reduce((a,b)=>a+b,0)/neighbors.length);}
      const local={nodes:members.map(n=>({...n,groupId:null})),groups:[],edges:data.edges.filter(e=>ids.has(e.source)&&ids.has(e.target))};
      const localContext={...context,deferRouting:true,orderHints:hints,viewport:{...context.viewport,width:Math.min(1000,context.viewport.width)}};
      let tile=algorithm==='elk'?null:U.StructuredLayout.layout(local,localContext,algorithm);
      if(!tile){tile=await U.GraphLayout(local,localContext,{direction:context.state.layoutDirection||'DOWN',inheritanceUp:true,nodeGap:58,layerGap:96});if(algorithm!=='elk')fallback=true;}
      const headerHeight=112+(group.noteHeight||0),headerBand=48+(group.noteHeight||0),minimumWidth=Math.max(300,context.measure(group.presentation.name,13,600)+230);
      const minX=Math.min(...tile.nodes.map(n=>n.x)),minY=Math.min(...tile.nodes.map(n=>n.y));
      const routingPadding={left:72,right:72,bottom:96};
      const nodes=tile.nodes.map(n=>({...n,groupId:group.id,x:n.x-minX+routingPadding.left,y:n.y-minY+headerHeight}));
      for(const node of nodes)hints.set(node.id,context.state.layoutDirection==='RIGHT'?node.y:node.x);
      tiles.push({...group,headerHeight,headerBand,minimumWidth,routingPadding,nodes,width:Math.max(minimumWidth,...nodes.map(n=>n.x+n.width+routingPadding.right)),height:Math.max(...nodes.map(n=>n.y+n.height+routingPadding.bottom))});
    }
    // Collapsed containers are real summary cards in the layout graph, never fake UML objects.
    const plain=data.nodes.filter(n=>!n.groupId).map(n=>({...U.Measure.node(n,context),layoutId:'tile:'+n.id}));
    const owner=new Map(data.nodes.map(n=>[n.id,n.groupId||'tile:'+n.id])),pairs=new Map();
    for(const edge of data.edges){const a=owner.get(edge.source),b=owner.get(edge.target);if(a===b)continue;const key=a+'|'+b;pairs.set(key,{id:'container-link:'+pairs.size,sources:[a],targets:[b]});}
    const children=[...tiles.map(g=>({id:g.id,width:g.width,height:g.height})),...plain.map(n=>({id:n.layoutId,width:n.width,height:n.height}))],connected=new Set([...pairs.values()].flatMap(e=>[...e.sources,...e.targets]));
    const fitScore=box=>Math.max(box.width/Math.max(500,context.viewport.width),box.height/Math.max(350,context.viewport.height));
    async function arrange(direction){
      const graph={id:'containers',layoutOptions:{'elk.algorithm':'layered','elk.direction':direction,'elk.spacing.nodeNode':'90','elk.layered.spacing.nodeNodeBetweenLayers':'120','elk.padding':'[top=36,left=36,bottom=36,right=36]','elk.layered.nodePlacement.strategy':'NETWORK_SIMPLEX'},children:children.filter(n=>connected.has(n.id)).map(n=>({...n})),edges:[...pairs.values()].map(e=>({...e,sources:[...e.sources],targets:[...e.targets]}))};
      const out=graph.children.length?await context.elk.layout(graph):{children:[],width:72,height:72};
      for(const child of children.filter(n=>!connected.has(n.id)).sort((a,b)=>b.width*b.height-a.width*a.height||a.id.localeCompare(b.id))){
        const candidates=[{x:36,y:36},...out.children.flatMap(n=>[{x:n.x,y:n.y+n.height+72},{x:n.x+n.width+72,y:n.y}]),{x:36,y:out.height+36}];
        const clear=p=>out.children.every(n=>p.x+child.width+32<=n.x||p.x>=n.x+n.width+32||p.y+child.height+32<=n.y||p.y>=n.y+n.height+32);
        const ranked=candidates.filter(clear).map(p=>({...p,score:fitScore({width:Math.max(out.width,p.x+child.width+36),height:Math.max(out.height,p.y+child.height+36)})})).sort((a,b)=>a.score-b.score||a.y-b.y||a.x-b.x),at=ranked[0];
        out.children.push({...child,x:at.x,y:at.y});out.width=Math.max(out.width,at.x+child.width+36);out.height=Math.max(out.height,at.y+child.height+36);
      }out.width=Math.max(72,...out.children.map(n=>n.x+n.width+36));out.height=Math.max(72,...out.children.map(n=>n.y+n.height+36));return out;
    }
    const options=await Promise.all([arrange('DOWN'),arrange('RIGHT')]),output=options.sort((a,b)=>fitScore(a)-fitScore(b))[0];
    const positioned=new Map(output.children.map(n=>[n.id,n])),nodes=[],frames=[];
    for(const tile of tiles){const at=positioned.get(tile.id);frames.push({...tile,x:at.x,y:at.y,nodes:undefined});for(const node of tile.nodes)nodes.push({...node,x:node.x+at.x,y:node.y+at.y});}
    for(const node of plain){const at=positioned.get(node.layoutId);nodes.push({...node,x:at.x,y:at.y});}
    return {nodes,groups:frames,edges:data.edges,labels:[],width:output.width,height:output.height,layoutInfo:{requested:algorithm,applied:fallback?'mixed':algorithm,basis:algorithm==='elk'?'namespace containers · hierarchical members':'namespace containers · '+algorithm+' members',fallback:fallback?'Some namespace members require hierarchical placement; namespace containers are preserved.':null}};
  }
  U.ContainerLayout={layout};
})(globalThis);
