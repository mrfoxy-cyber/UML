(function(root){
  'use strict';const U=root.UmlViewer ||= {},round=n=>Math.round(n*100)/100;
  function build(scene){
    const buckets=new Map(),markers=new Map(),segments=[];
    for(const edge of scene.edges){
      for(const [pathIndex,path] of (edge.branchPaths||[edge.points]).entries())for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],horizontal=Math.abs(a.y-b.y)<.1,lo=round(Math.min(horizontal?a.x:a.y,horizontal?b.x:b.y)),hi=round(Math.max(horizontal?a.x:a.y,horizontal?b.x:b.y));if(hi-lo<.1)continue;
        const familyId=edge.cableId?edge.cableId+':'+pathIndex:edge.familyId,coordinate=round(horizontal?a.y:a.x),key=JSON.stringify([familyId,horizontal,coordinate]);if(!buckets.has(key))buckets.set(key,{horizontal,coordinate,parts:[],familyId});buckets.get(key).parts.push({lo,hi,edge});
      }
      const startsAtSource=['aggregation','composition'].includes(edge.kind),collapsedTerminal=startsAtSource?edge.cableCollapsedSource:edge.cableCollapsedTarget;
      const marker=edge.unrouted||collapsedTerminal?null:['inheritance','implementation'].includes(edge.kind)?'triangle':startsAtSource?edge.kind==='aggregation'?'diamond':'filled-diamond':edge.kind==='association'?null:'arrow';
      if(marker){const start=['aggregation','composition'].includes(edge.kind),ends=start?edge.points.slice(0,2):edge.points.slice(-2),at=start?ends[0]:ends[1],other=start?ends[1]:ends[0],length=Math.hypot(other.x-at.x,other.y-at.y)||1,near={x:at.x+(other.x-at.x)/length*Math.min(18,length),y:at.y+(other.y-at.y)/length*Math.min(18,length)},points=start?[at,near]:[near,at],key=JSON.stringify([edge.familyId,marker,start,points]);if(!markers.has(key))markers.set(key,{id:'terminal:'+markers.size,points,start,marker,kind:edge.kind,context:edge.context,memberIds:[]});markers.get(key).memberIds.push(edge.id);}
    }
    for(const bucket of buckets.values()){
      const splits=[...new Set(bucket.parts.flatMap(p=>[p.lo,p.hi]))].sort((a,b)=>a-b);
      for(let i=1;i<splits.length;i++){const lo=splits[i-1],hi=splits[i],parts=bucket.parts.filter(p=>p.lo<=lo+.05&&p.hi>=hi-.05);if(!parts.length)continue;
        const edge=parts[0].edge,memberIds=[...new Set(parts.map(p=>p.edge.id))].sort(),points=bucket.horizontal?[{x:lo,y:bucket.coordinate},{x:hi,y:bucket.coordinate}]:[{x:bucket.coordinate,y:lo},{x:bucket.coordinate,y:hi}];
        const mixed=parts.some(p=>p.edge.kind!==edge.kind);segments.push({id:'route:'+segments.length,points,memberIds,kind:mixed?'collection':edge.kind,color:edge.color,context:parts.every(p=>p.edge.context),familyId:bucket.familyId,length:hi-lo,cableId:edge.cableId});
      }
    }
    const badges=[],families=new Set();for(const segment of [...segments].sort((a,b)=>b.length-a.length))if(!segment.cableId&&segment.memberIds.length>1&&segment.length>50&&!families.has(segment.familyId)){families.add(segment.familyId);const [a,b]=segment.points,box={x:(a.x+b.x)/2-11,y:(a.y+b.y)/2-23,width:22,height:18};if(!scene.nodes.some(n=>box.x<n.x+n.width&&box.x+22>n.x&&box.y<n.y+n.height&&box.y+18>n.y))badges.push({...segment,box});}
    scene.routeNetwork={segments,markers:[...markers.values()],badges,cables:scene.namespaceCables||[],gates:scene.namespaceGates||[]};return scene.routeNetwork;
  }
  U.ConnectionSegments={build};
})(globalThis);
