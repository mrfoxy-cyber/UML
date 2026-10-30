(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  const center=n=>({x:n.x+n.width/2,y:n.y+n.height/2});
  function assign(scene,families,cablePlan=null){
    const nodes=new Map(scene.nodes.map(n=>[n.id,n])),groups=new Map(scene.groups.map(g=>[g.id,g])),requests=new Map(),result=new Map();
    function side(node,remote,kind){const external=node.groupId!==remote.groupId,a=center(external&&groups.get(node.groupId)||node),b=center(external&&groups.get(remote.groupId)||remote),dx=b.x-a.x,dy=b.y-a.y;
      if(!external&&['inheritance','implementation'].includes(kind)&&Math.abs(dy)>30)return dy>0?'bottom':'top';return Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'bottom':'top';}
    function add(edge,node,remote,at,family){const cable=cablePlan?.byEdge.get(edge.id),shared=family.mode==='pair'||family.mode===(at==='source'?'source':'target'),token=cable?JSON.stringify([cable.id,at,node.id,edge.kind,edge.label||'',edge.fromMultiplicity||'',edge.toMultiplicity||'',!!edge.context]):shared?family.id+':'+node.id:edge.id+':'+at;
      const siblings=shared?family.edges.map(e=>nodes.get(at==='source'?e.target:e.source)): [remote],average={x:siblings.reduce((s,n)=>s+center(n).x,0)/siblings.length,y:siblings.reduce((s,n)=>s+center(n).y,0)/siblings.length,width:0,height:0,groupId:remote.groupId};
      const gate=cable?.[at+'Gate'],edgeSide=gate?U.NamespaceCables.endpointSide(scene,node,gate):side(node,average,edge.kind),key=node.id+'|'+edgeSide;if(!requests.has(key))requests.set(key,new Map());const map=requests.get(key);if(!map.has(token))map.set(token,{node,side:edgeSide,remote:average,entries:[],token});map.get(token).entries.push({edge,at});
    }
    for(const family of families)for(const edge of family.edges){const a=nodes.get(edge.source),b=nodes.get(edge.target);if(!a||!b)continue;add(edge,a,b,'source',family);add(edge,b,a,'target',family);}
    for(const map of requests.values()){
      const values=[...map.values()].sort((a,b)=>['top','bottom'].includes(a.side)?a.remote.x-b.remote.x||a.token.localeCompare(b.token):a.remote.y-b.remote.y||a.token.localeCompare(b.token));
      values.forEach((request,i)=>{const {node,side}=request,vertical=['top','bottom'].includes(side),size=vertical?node.width:node.height,step=Math.min(18,(size-40)/Math.max(1,values.length)),offset=size/2+(i-(values.length-1)/2)*step;
        const point=vertical?{x:node.x+offset,y:node.y+(side==='bottom'?node.height:0)}:{x:node.x+(side==='right'?node.width:0),y:node.y+offset};
        const vector={x:side==='right'?1:side==='left'?-1:0,y:side==='bottom'?1:side==='top'?-1:0},stub={x:point.x+vector.x*18,y:point.y+vector.y*18};
        const container=groups.get(node.groupId);if(side==='top'&&container)stub.y=Math.max(stub.y,container.y+(container.headerBand||48)+10);
        const terminal={point,stub,side,vector,node,key:request.token};for(const {edge,at} of request.entries){if(!result.has(edge.id))result.set(edge.id,{});result.get(edge.id)[at]=terminal;}
      });
    }
    const gates=new Map();
    for(const [edgeId,pair] of result)for(const at of ['source','target']){const terminal=pair[at],other=pair[at==='source'?'target':'source'],group=groups.get(terminal.node.groupId);if(!group||terminal.node.groupId===other.node.groupId||cablePlan?.byEdge.has(edgeId))continue;
      const side=terminal.side==='top'?(terminal.point.x<group.x+group.width/2?'left':'right'):terminal.side,key=group.id+'|'+side;if(!gates.has(key))gates.set(key,new Map());gates.get(key).set(terminal.key,{terminal,group,side});
    }
    for(const requests of gates.values()){
      const values=[...requests.values()],vertical=['left','right'].includes(values[0].side),group=values[0].group,min=vertical?group.y+(group.headerBand||48)+22:group.x+30,max=vertical?group.y+group.height-18:group.x+group.width-30,step=Math.min(18,(max-min)/Math.max(1,values.length-1));
      values.sort((a,b)=>(vertical?a.terminal.point.y-b.terminal.point.y:a.terminal.point.x-b.terminal.point.x)||a.terminal.key.localeCompare(b.terminal.key));
      const slots=values.map(v=>Math.max(min,Math.min(max,vertical?v.terminal.point.y:v.terminal.point.x)));for(let i=1;i<slots.length;i++)slots[i]=Math.max(slots[i],slots[i-1]+step);if(slots.at(-1)>max){slots[slots.length-1]=max;for(let i=slots.length-2;i>=0;i--)slots[i]=Math.min(slots[i],slots[i+1]-step);}
      values.forEach(({terminal,group,side},i)=>{const inside=vertical?{x:group.x+(side==='right'?group.width:0),y:slots[i]}:{x:slots[i],y:group.y+group.height},vector=vertical?{x:side==='right'?1:-1,y:0}:{x:0,y:1};terminal.gateway={inside,outside:{x:inside.x+vector.x*26,y:inside.y+vector.y*26}};});
    }
    return result;
  }
  function gateway(terminal,other,scene){
    if(terminal.gateway)return terminal.gateway;
    const group=scene.groups.find(g=>g.id===terminal.node.groupId);if(!group||terminal.node.groupId===other.node.groupId)return null;
    const side=terminal.side,pad=28,inside={x:Math.max(group.x+pad,Math.min(group.x+group.width-pad,terminal.point.x)),y:Math.max(group.y+(group.headerHeight||64)+12,Math.min(group.y+group.height-pad,terminal.point.y))};
    if(side==='left')inside.x=group.x;if(side==='right')inside.x=group.x+group.width;
    // Keep the namespace header intact: top-facing external routes exit from a side below it.
    let vector=terminal.vector;if(side==='top'){inside.y=group.y+(group.headerHeight||64)+12;inside.x=other.point.x<inside.x?group.x:group.x+group.width;vector={x:inside.x===group.x?-1:1,y:0};}
    if(side==='bottom')inside.y=group.y+group.height;
    return {inside,outside:{x:inside.x+vector.x*26,y:inside.y+vector.y*26}};
  }
  U.ConnectionPorts={assign,gateway,center};
})(globalThis);
