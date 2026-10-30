(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  function components(nodes,edges){
    const neighbors=new Map(nodes.map(n=>[n.id,new Set()]));for(const e of edges){neighbors.get(e.source)?.add(e.target);neighbors.get(e.target)?.add(e.source);}
    const remaining=new Set(nodes.map(n=>n.id)),result=[];
    for(const node of nodes){if(!remaining.delete(node.id))continue;const ids=new Set([node.id]),queue=[node.id];while(queue.length){const id=queue.pop();for(const other of neighbors.get(id)||[])if(remaining.delete(other)){ids.add(other);queue.push(other);}}result.push(nodes.filter(n=>ids.has(n.id)));}
    return result.sort((a,b)=>b.length-a.length||a[0].item.name.localeCompare(b[0].item.name));
  }
  function layered(nodes,edges,hints=new Map()){
    const ids=new Set(nodes.map(n=>n.id)),parents=new Map(nodes.map(n=>[n.id,[]])),children=new Map(nodes.map(n=>[n.id,[]]));
    for(const edge of edges)if(ids.has(edge.source)&&ids.has(edge.target)){parents.get(edge.source).push(edge.target);children.get(edge.target).push(edge.source);}
    const pending=new Map(nodes.map(n=>[n.id,parents.get(n.id).length])),rank=new Map(),queue=nodes.filter(n=>!pending.get(n.id)).map(n=>n.id);
    for(const id of queue){rank.set(id,rank.get(id)||0);for(const child of children.get(id)){rank.set(child,Math.max(rank.get(child)||0,rank.get(id)+1));pending.set(child,pending.get(child)-1);if(!pending.get(child))queue.push(child);}}
    if(queue.length!==nodes.length)return null;
    const levels=[];for(const node of nodes){const level=rank.get(node.id);(levels[level] ||= []).push(node);}
    const rows=levels.flatMap(level=>{level.sort((a,b)=>(hints.get(a.id)??Infinity)-(hints.get(b.id)??Infinity)||a.item.name.localeCompare(b.item.name)||a.id.localeCompare(b.id));const result=[];for(let i=0;i<level.length;i+=4)result.push(level.slice(i,i+4));return result;});
    const width=Math.max(...rows.map(level=>level.reduce((n,node)=>n+node.width,0)+(level.length-1)*60));let y=0;
    for(const level of rows){let x=(width-level.reduce((n,node)=>n+node.width,0)-(level.length-1)*60)/2;for(const node of level){node.x=x;node.y=y;x+=node.width+60;}y+=Math.max(...level.map(n=>n.height))+110;}
    return {nodes,width,height:y-90};
  }
  function seriesParallel(nodes,edges){
    const ids=new Set(nodes.map(n=>n.id)),start=Symbol('start'),end=Symbol('end'),active=new Set([start,end,...ids]);
    let arcs=edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>({from:e.target,to:e.source,tree:{kind:'edge'}}));
    const roots=nodes.filter(n=>!arcs.some(e=>e.to===n.id)),leaves=nodes.filter(n=>!arcs.some(e=>e.from===n.id));
    if(!roots.length||!leaves.length)return null;
    arcs.push(...roots.map(n=>({from:start,to:n.id,tree:{kind:'edge'}})),...leaves.map(n=>({from:n.id,to:end,tree:{kind:'edge'}})));
    let changed=true;
    while(changed){
      changed=false;
      outer:for(let i=0;i<arcs.length;i++)for(let j=i+1;j<arcs.length;j++)if(arcs[i].from===arcs[j].from&&arcs[i].to===arcs[j].to){
        const a=arcs[i],b=arcs[j];arcs[i]={from:a.from,to:a.to,tree:{kind:'parallel',parts:[a.tree,b.tree]}};arcs.splice(j,1);changed=true;break outer;
      }
      if(changed)continue;
      for(const id of active){
        if(id===start||id===end)continue;const incoming=arcs.filter(e=>e.to===id),outgoing=arcs.filter(e=>e.from===id);
        if(incoming.length!==1||outgoing.length!==1||incoming[0]===outgoing[0])continue;
        const a=incoming[0],b=outgoing[0];arcs=arcs.filter(e=>e!==a&&e!==b);arcs.push({from:a.from,to:b.to,tree:{kind:'series',left:a.tree,node:nodes.find(n=>n.id===id),right:b.tree}});active.delete(id);changed=true;break;
      }
    }
    if(active.size!==2||arcs.length!==1||arcs[0].from!==start||arcs[0].to!==end)return null;
    function compose(tree){
      if(tree.kind==='edge')return {nodes:[],width:24,height:0};
      if(tree.kind==='parallel'){
        const parts=tree.parts.map(compose),height=Math.max(...parts.map(p=>p.height));let x=0;const positioned=[];
        for(const part of parts){for(const node of part.nodes)positioned.push({...node,x:node.x+x});x+=part.width+44;}
        return {nodes:positioned,width:x-44,height};
      }
      const before=compose(tree.left),after=compose(tree.right),node=tree.node,width=Math.max(before.width,node.width,after.width),gap=70;
      const y=before.height?before.height+gap:0,afterY=y+node.height+(after.height?gap:0);
      return {width,height:afterY+after.height,nodes:[...before.nodes.map(n=>({...n,x:n.x+(width-before.width)/2})),{...node,x:(width-node.width)/2,y},...after.nodes.map(n=>({...n,x:n.x+(width-after.width)/2,y:n.y+afterY}))]};
    }
    return compose(arcs[0].tree);
  }
  function layout(data,context,algorithm){
    const right=context.state.layoutDirection==='RIGHT',measured=data.nodes.map(n=>U.Measure.node(n,context));
    const logical=measured.map(n=>({...n,width:right?n.height:n.width,height:right?n.width:n.height}));
    const primary=data.edges.filter(e=>e.kind==='inheritance'),fallback=data.edges.filter(e=>e.kind==='implementation'),basis=primary.length?primary:fallback;
    const tiles=[];
    for(const members of components(logical,basis)){
      const ids=new Set(members.map(n=>n.id)),links=basis.filter(e=>ids.has(e.source)&&ids.has(e.target));
      members.sort((a,b)=>(context.orderHints?.get(a.id)??Infinity)-(context.orderHints?.get(b.id)??Infinity)||a.id.localeCompare(b.id));
      const tile=algorithm==='series-parallel'?seriesParallel(members,links):layered(members,links,context.orderHints);if(!tile)return null;
      if(right){tile.nodes=tile.nodes.map(n=>({...n,x:n.y,y:n.x,width:n.height,height:n.width}));[tile.width,tile.height]=[tile.height,tile.width];}
      tiles.push(tile);
    }
    const target=Math.max(700,Math.min(1100,context.viewport.width*1.1),...tiles.map(tile=>tile.width));
    let x=36,y=36,rowHeight=0,width=0;const nodes=[];
    for(const tile of tiles){if(x>36&&x+tile.width>target){x=36;y+=rowHeight+80;rowHeight=0;}for(const n of tile.nodes)nodes.push({...n,x:n.x+x,y:n.y+y});width=Math.max(width,x+tile.width+36);x+=tile.width+70;rowHeight=Math.max(rowHeight,tile.height);}
    const scene={nodes,edges:data.edges,groups:[],labels:[],width:Math.max(600,width),height:Math.max(300,y+rowHeight+36),layoutInfo:{applied:algorithm,basis:primary.length?'inheritance backbone':fallback.length?'interface backbone':'independent types'}};
    return context.deferRouting?scene:U.EdgeRouter.scene(scene);
  }
  U.StructuredLayout={layout};if(typeof module==='object'&&module.exports)module.exports=U.StructuredLayout;
})(globalThis);
