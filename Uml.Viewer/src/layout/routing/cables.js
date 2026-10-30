(function(root){
  'use strict';
  const U=root.UmlViewer ||= {};
  const palette=['#287e78','#5779b6','#9971ac','#af8140','#b56e80','#657f91','#69864d','#8d719b'];
  const center=box=>({x:box.x+box.width/2,y:box.y+box.height/2});
  const vector=side=>({x:side==='right'?1:side==='left'?-1:0,y:side==='bottom'?1:side==='top'?-1:0});
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

  function plan(scene){
    if(scene.routingMode==='separate')return {cables:[],gates:[],byEdge:new Map(),containers:[]};
    const nodes=new Map(scene.nodes.map(n=>[n.id,n])),groups=new Map(scene.groups.map(g=>[g.id,g])),pairs=new Map();
    for(const node of nodes.values())if(node.kind==='collapsed-group')groups.set(node.id,{...node,item:node.item,headerBand:0,collapsed:true});
    const owner=node=>node?.groupId||(node?.kind==='collapsed-group'?node.id:null);
    for(const edge of scene.edges){const a=owner(nodes.get(edge.source)),b=owner(nodes.get(edge.target));if(!a||!b||a===b)continue;
      const key=JSON.stringify([a,b]);if(!pairs.has(key))pairs.set(key,{id:'cable:'+key,sourceGroupId:a,targetGroupId:b,edges:[]});pairs.get(key).edges.push(edge);
    }
    const cables=[...pairs.values()].sort((a,b)=>a.id.localeCompare(b.id)),gates=[],byEdge=new Map(),usedColors=new Set();
    for(const cable of cables){
      let hash=0;for(const ch of cable.id)hash=(hash*31+ch.charCodeAt(0))>>>0;let index=hash%palette.length;while(usedColors.has(index)&&usedColors.size<palette.length)index=(index+1)%palette.length;usedColors.add(index);cable.color=palette[index];
      cable.edges.sort((a,b)=>a.id.localeCompare(b.id));cable.memberIds=cable.edges.map(e=>e.id);cable.originalMemberIds=[...new Set(cable.edges.flatMap(e=>(e.originals||[e]).map(r=>r.id)))];cable.relationshipCount=cable.originalMemberIds.length;cable.context=cable.edges.every(e=>e.context);
      const a=groups.get(cable.sourceGroupId),b=groups.get(cable.targetGroupId),ac=center(a),bc=center(b);cable.sourceName=a.item.name;cable.targetName=b.item.name;
      let outSide,inSide;
      if(a.x+a.width<=b.x){outSide='right';inSide='left';}
      else if(b.x+b.width<=a.x){outSide='left';inSide='right';}
      else if(a.y+a.height<=b.y){outSide='bottom';inSide=ac.x<=bc.x?'left':'right';}
      else if(b.y+b.height<=a.y){outSide=bc.x<=ac.x?'left':'right';inSide='bottom';}
      else{outSide=bc.x>=ac.x?'right':'left';inSide=outSide==='right'?'left':'right';}
      for(const [at,group,side,remote] of [['source',a,outSide,bc],['target',b,inSide,ac]]){
        const gate={id:cable.id+':'+at,cableId:cable.id,groupId:group.id,groupName:group.item.name,side,flow:at==='source'?'out':'in',color:cable.color,memberIds:cable.memberIds,context:cable.context,group,remote};
        cable[at+'Gate']=gate;gates.push(gate);
      }
      for(const edge of cable.edges)byEdge.set(edge.id,cable);
    }
    const bySide=new Map();for(const gate of gates){const key=gate.groupId+'|'+gate.side;if(!bySide.has(key))bySide.set(key,[]);bySide.get(key).push(gate);}
    for(const entries of bySide.values()){
      const group=entries[0].group,vertical=['left','right'].includes(entries[0].side),minimum=vertical?group.y+(group.collapsed?16:(group.headerBand||48)+38):group.x+54,maximum=vertical?group.y+group.height-(group.collapsed?16:38):group.x+group.width-54;
      entries.sort((a,b)=>a.flow.localeCompare(b.flow)||(vertical?a.remote.y-b.remote.y:a.remote.x-b.remote.x)||a.id.localeCompare(b.id));
      const spacing=Math.min(18,(maximum-minimum)/Math.max(1,entries.length-1)),mid=(minimum+maximum)/2;
      const banks=new Map();for(const gate of entries){const bankId=gate.groupId+'|'+gate.side+'|'+gate.flow;if(!banks.has(bankId))banks.set(bankId,[]);banks.get(bankId).push(gate);}
      for(const [bankId,members] of banks)members.forEach((gate,index)=>{gate.bankId=bankId;gate.bankIndex=index;gate.bankSize=members.length;});
      entries.forEach((gate,index)=>{const at=clamp(mid+(index-(entries.length-1)/2)*spacing,minimum,maximum),v=vector(gate.side),point=vertical?{x:group.x+(gate.side==='right'?group.width:0),y:at}:{x:at,y:group.y+group.height};
        gate.point=point;gate.vector=v;gate.outside={x:Math.max(8,point.x+v.x*36),y:Math.max(8,point.y+v.y*36)};gate.inside={x:point.x-v.x*18,y:point.y-v.y*18};
        const depth=32+index*12;gate.rail={x:point.x-v.x*depth,y:point.y-v.y*depth};
      });
    }
    return {cables,gates,byEdge,containers:[...groups.values()]};
  }

  function endpointSide(scene,node,gate){
    if(gate.group.collapsed)return gate.side;
    const primary=gate.side,candidates=primary==='bottom'?['bottom','left','right']:primary==='left'?['left','top','bottom']:['right','top','bottom'];
    const others=scene.nodes.filter(n=>n.groupId===node.groupId&&n.id!==node.id),c=center(node),vertical=['left','right'].includes(gate.side);
    return candidates.map((side,index)=>{const v=vector(side),point={x:c.x+v.x*node.width/2,y:c.y+v.y*node.height/2},stub={x:point.x+v.x*18,y:point.y+v.y*18},projection=vertical?{x:gate.rail.x,y:stub.y}:{x:stub.x,y:gate.rail.y};
      const collisions=others.filter(n=>U.ConnectionChannels.hits(stub,projection,{x:n.x-8,y:n.y-8,width:n.width+16,height:n.height+16})).length;
      return {side,score:collisions*1000+index*30+Math.abs(stub.x-projection.x)+Math.abs(stub.y-projection.y)};
    }).sort((a,b)=>a.score-b.score)[0].side;
  }

  function route(scene,{fast=false,routeInternal}){
    const planned=plan(scene);if(!planned.cables.length)return null;
    const families=U.ConnectionFamilies.build(scene),ports=U.ConnectionPorts.assign(scene,families,planned),channels=U.ConnectionChannels.create(scene),clean=U.RouteSimplifier.clean;
    const externalBoxes=planned.containers.map(g=>({x:g.x-10,y:g.y-10,width:g.width+20,height:g.height+20}));
    for(const family of families)for(const edge of family.edges){const pair=ports.get(edge.id),cable=planned.byEdge.get(edge.id);if(pair)for(const terminal of [pair.source,pair.target])channels.reserve([terminal.point,terminal.stub],cable?cable.id:family.id);}
    for(const gate of planned.gates)channels.reserve([gate.inside,gate.point,gate.outside],gate.cableId);
    for(const cable of planned.cables){
      const a=cable.sourceGate,b=cable.targetGate;let middle=channels.path(a.outside,b.outside,externalBoxes,cable.id,{fast});
      if(!middle&&!fast)middle=channels.path(a.outside,b.outside,externalBoxes,cable.id,{relaxed:true});
      cable.unrouted=!middle;cable.points=middle?clean([a.point,...middle,b.point]):[a.point,a.outside];channels.reserve(cable.points,cable.id);
    }
    const internal=routeInternal({...scene,edges:scene.edges.filter(e=>!planned.byEdge.has(e.id))},{fast,skipCables:true,ports,channels});
    const routed=new Map(internal.edges.map(e=>[e.id,e]));
    for(const cable of planned.cables){
      const cache=new Map();
      function branch(edge,at){
        const terminal=ports.get(edge.id)[at],gate=cable[at+'Gate'],group=gate.group;
        if(group.collapsed)return {points:[gate.point],warning:false};
        const key=JSON.stringify([at,terminal.point,edge.kind,edge.label||'',edge.fromMultiplicity||'',edge.toMultiplicity||'',!!edge.context]);if(cache.has(key))return cache.get(key);
        const boxes=[...scene.nodes.filter(n=>n.groupId===group.id).map(n=>({x:n.x-8,y:n.y-8,width:n.width+16,height:n.height+16})),{x:group.x,y:group.y,width:group.width,height:group.headerBand||48}];
        const bounds={x:group.x+8,y:group.y+(group.headerBand||48)+8,width:group.width-16,height:group.height-(group.headerBand||48)-16};
        const vertical=['left','right'].includes(gate.side),projection=vertical?{x:gate.rail.x,y:terminal.stub.y}:{x:terminal.stub.x,y:gate.rail.y};
        let arm=channels.path(terminal.stub,projection,boxes,cable.id,{fast,bounds}),warning=false;
        if(!arm&&!fast){arm=channels.path(terminal.stub,projection,boxes,cable.id,{bounds,relaxed:true});warning=!!arm;}
        if(!arm){arm=channels.path(terminal.stub,gate.rail,boxes,cable.id,{fast,bounds});if(arm)arm=clean([...arm]);}
        let result=null;
        if(arm){const end=arm.at(-1),rail=end.x===gate.rail.x||end.y===gate.rail.y?[end,gate.rail]:null;if(rail&&!rail.slice(1).some((p,i)=>boxes.some(box=>U.ConnectionChannels.hits(rail[i],p,box)))){const points=clean([terminal.point,...arm,...rail.slice(1),gate.inside,gate.point]);channels.reserve(points,cable.id);result={points,warning};}}
        cache.set(key,result);return result;
      }
      for(const edge of cable.edges){const source=branch(edge,'source'),target=branch(edge,'target'),unrouted=cable.unrouted||!source||!target;
        const branchPaths=[source?.points||[ports.get(edge.id).source.point,ports.get(edge.id).source.stub],target?.points.slice().reverse()||[]];
        const points=unrouted?branchPaths[0]:clean([...source.points,...cable.points.slice(1),...target.points.slice(0,-1).reverse()]);
        routed.set(edge.id,{...edge,points,branchPaths,cableId:cable.id,color:cable.color,familyId:cable.id,cableCollapsedSource:!!cable.sourceGate.group.collapsed,cableCollapsedTarget:!!cable.targetGate.group.collapsed,routingWarning:unrouted||source?.warning||target?.warning,unrouted});
      }
    }
    scene.edges=scene.edges.map(e=>routed.get(e.id)||e);scene.namespaceCables=planned.cables;scene.namespaceGates=planned.gates;
    U.ConnectionLabels.place(scene);U.ConnectionSegments.build(scene);
    scene.routingInfo={families:families.length,cables:planned.cables.length,gates:planned.gates.length,sharedSegments:scene.routeNetwork.segments.filter(s=>s.memberIds.length>1).length,mode:'bundled'};
    scene.width=Math.max(scene.width,...scene.edges.flatMap(e=>e.points.map(p=>p.x+52)));scene.height=Math.max(scene.height,...scene.edges.flatMap(e=>e.points.map(p=>p.y+52)));
    return scene;
  }
  U.NamespaceCables={plan,endpointSide,route};
})(globalThis);
