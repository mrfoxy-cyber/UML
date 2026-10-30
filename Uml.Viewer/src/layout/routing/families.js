(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  function build(scene){
    const nodes=new Map(scene.nodes.map(n=>[n.id,n])),remaining=new Set(scene.edges),families=[];
    const style=e=>JSON.stringify([e.kind,!!e.context,e.fromMultiplicity||'',e.toMultiplicity||'',e.label||'']);
    const eligible=e=>!e.proxy&&!e.label&&!e.fromMultiplicity&&!e.toMultiplicity&&e.source!==e.target;
    function collect(key,mode,filter){const buckets=new Map();for(const edge of remaining){if(!filter(edge))continue;const k=key(edge);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(edge);}for(const edges of buckets.values())if(edges.length>1){add(edges,mode);}}
    function add(edges,mode){edges.sort((a,b)=>a.id.localeCompare(b.id));const family={id:'family:'+edges[0].id,kind:edges[0].kind,edges,mode};families.push(family);for(const e of edges)remaining.delete(e);}
    if(scene.routingMode!=='separate'){
      collect(e=>e.source+'|'+e.target+'|'+style(e),'pair',e=>e.source!==e.target);
      collect(e=>e.target+'|'+style(e)+'|'+(nodes.get(e.source)?.groupId||''),'target',eligible);
      collect(e=>e.source+'|'+style(e)+'|'+(nodes.get(e.target)?.groupId||''),'source',e=>eligible(e)&&!['inheritance','implementation','aggregation','composition'].includes(e.kind));
    }
    for(const e of remaining)add([e],'single');
    return families.sort((a,b)=>Number(!['inheritance','implementation'].includes(a.kind))-Number(!['inheritance','implementation'].includes(b.kind))||b.edges.length-a.edges.length||a.id.localeCompare(b.id));
  }
  U.ConnectionFamilies={build};
})(globalThis);
