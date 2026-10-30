(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  function scene(scene,{fast=false,skipCables=false,ports:assignedPorts=null,channels:assignedChannels=null}={}){
    if(!skipCables&&U.NamespaceCables){const result=U.NamespaceCables.route(scene,{fast,routeInternal:(subset,options)=>U.ConnectionRouter.scene(subset,options)});if(result)return result;}
    scene.namespaceCables=[];scene.namespaceGates=[];
    const families=U.ConnectionFamilies.build(scene),ports=assignedPorts||U.ConnectionPorts.assign(scene,families),channels=assignedChannels||U.ConnectionChannels.create(scene),routed=new Map();
    // Reserve mandatory terminal stubs and boundary crossings before any flexible route.
    // Later connections must not be forced onto a lane an earlier path happened to occupy.
    for(const family of families)for(const relation of family.edges){const pair=ports.get(relation.id);if(pair)for(const terminal of [pair.source,pair.target]){channels.reserve([terminal.point,terminal.stub],family.id);if(terminal.gateway)channels.reserve([terminal.gateway.inside,terminal.gateway.outside],family.id);}}
    for(const family of families){
      const cache=new Map(),edge=family.edges[0],p=ports.get(edge.id);if(!p)continue;
      const obstacles=U.ConnectionChannels.boxes(scene,edge),sameGroup=p.source.node.groupId&&p.source.node.groupId===p.target.node.groupId,group=sameGroup&&scene.groups.find(g=>g.id===p.source.node.groupId);
      const bounds=group?{x:group.x+10,y:group.y+(group.headerBand||48)+8,width:group.width-20,height:group.height-(group.headerBand||48)-18}:null;
      let warning=false;
      function path(a,b,boxes=obstacles){let result=channels.path(a,b,boxes,family.id,{fast,bounds});if(!result&&!fast){result=channels.path(a,b,boxes,family.id,{bounds,relaxed:true});if(result)warning=true;}return result;}
      function connector(terminal,other,relation){
        const key=terminal.node.id+'|'+terminal.side+'|'+terminal.point.x+'|'+terminal.point.y;if(cache.has(key))return cache.get(key);
        const gate=U.ConnectionPorts.gateway(terminal,other,scene),points=[terminal.point,terminal.stub];
        if(gate){const inside=path(terminal.stub,gate.inside,U.ConnectionChannels.boxes(scene,relation));if(!inside)return null;points.push(...inside.slice(1),gate.outside);}
        const result=U.RouteSimplifier.clean(points);cache.set(key,result);return result;
      }
      let common=null,junction=null;
      if(['source','target'].includes(family.mode)){
        const at=family.mode,other=at==='source'?'target':'source',terminal=p[at],gate=U.ConnectionPorts.gateway(terminal,p[other],scene);
        if(gate){common=connector(terminal,p[other],edge);junction=common?.at(-1);}
        else{
          const projections=family.edges.map(e=>ports.get(e.id)[other].stub).map(point=>(point.x-terminal.point.x)*terminal.vector.x+(point.y-terminal.point.y)*terminal.vector.y);
          const distance=Math.max(26,Math.min(80,Math.min(...projections)/2));junction={x:terminal.point.x+terminal.vector.x*distance,y:terminal.point.y+terminal.vector.y*distance};
          const middle=path(terminal.stub,junction);if(middle)common=U.RouteSimplifier.clean([terminal.point,...middle]);
        }
        if(common)channels.reserve(common,family.id);
      }
      for(const relation of family.edges){
        const terminals=ports.get(relation.id),boxes=U.ConnectionChannels.boxes(scene,relation);let points=null,unrouted=false;
        if(relation.source===relation.target){
          const a=terminals.source.node,x=a.x+a.width,y=a.y+a.height/2,loop=[{x,y},{x:x+24,y},{x:x+24,y:a.y+a.height+24},{x:a.x+a.width/2,y:a.y+a.height+24},{x:a.x+a.width/2,y:a.y+a.height}];
          const otherBoxes=boxes.filter(r=>!(r.x===a.x-8&&r.y===a.y-8));if(loop.slice(1).every((v,i)=>!otherBoxes.some(r=>U.ConnectionChannels.hits(loop[i],v,r))))points=loop;
        }else if(family.mode==='pair'&&routed.has(edge.id)){points=routed.get(edge.id).points;unrouted=routed.get(edge.id).unrouted;}
        else if(common){
          const at=family.mode==='source'?'target':'source',branch=connector(terminals[at],terminals[family.mode],relation);
          if(branch){const middle=path(branch.at(-1),junction,boxes);if(middle){const fromBranch=U.RouteSimplifier.clean([...branch,...middle.slice(1),...common.slice(0,-1).reverse()]);points=family.mode==='target'?fromBranch:fromBranch.reverse();}}
        }
        if(!points&&relation.source!==relation.target){const from=connector(terminals.source,terminals.target,relation),to=connector(terminals.target,terminals.source,relation);if(from&&to){const middle=path(from.at(-1),to.at(-1),boxes);if(middle)points=U.RouteSimplifier.clean([...from,...middle.slice(1),...to.slice(0,-1).reverse()]);}}
        if(!points){warning=true;unrouted=true;points=[terminals.source.point,terminals.source.stub];}
        channels.reserve(points,family.id);routed.set(relation.id,{...relation,points,familyId:family.id,routingWarning:warning,unrouted});
      }
    }
    scene.edges=scene.edges.map(edge=>routed.get(edge.id)||edge);U.ConnectionLabels.place(scene);U.ConnectionSegments.build(scene);
    scene.routingInfo={families:families.length,sharedSegments:scene.routeNetwork.segments.filter(s=>s.memberIds.length>1).length,mode:scene.routingMode||'bundled'};
    scene.width=Math.max(scene.width,...scene.edges.flatMap(e=>e.points.map(p=>p.x+24)),...scene.edges.filter(e=>e.labelBox).map(e=>e.labelBox.x+e.labelBox.width+24));scene.height=Math.max(scene.height,...scene.edges.flatMap(e=>e.points.map(p=>p.y+24)),...scene.edges.filter(e=>e.labelBox).map(e=>e.labelBox.y+e.labelBox.height+24));
    return scene;
  }
  U.ConnectionRouter={scene};
})(globalThis);
