(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  async function graph(data,context,policy){
    if(!data.nodes.length)return {width:600,height:300,nodes:[],edges:[],groups:[],labels:[]};
    const nodes=data.nodes.map(n=>U.Measure.node(n,context)),byId=new Map(nodes.map(n=>[n.id,n]));
    for(const group of data.groups)group.noteHeight=group.presentation.show.has('notes')&&group.item.notes?Math.min(110,U.Measure.wrap(group.item.notes,224,context.measure,12).length*18+8):0;
    const groupNodes=data.groups.map(group=>({id:group.id,children:nodes.filter(n=>n.groupId===group.id).map(n=>({id:n.id,width:n.width,height:n.height})),layoutOptions:{'elk.padding':`[top=${60+group.noteHeight},left=24,bottom=24,right=24]`,'elk.direction':policy.direction}}));
    const plain=nodes.filter(n=>!n.groupId).map(n=>({id:n.id,width:n.width,height:n.height}));
    const labels=new Map();
    const edges=data.edges.map((edge,i)=>{
      const reverse=policy.inheritanceUp&&['inheritance','implementation'].includes(edge.kind);
      const lines=edge.label?U.Measure.wrap(edge.label,190,context.measure,12):[];
      const label=lines.length?{id:'label:'+i,text:edge.label,width:Math.min(200,Math.max(...lines.map(l=>context.measure(l,12)))+16),height:lines.length*17+8}:null;
      labels.set(edge.id,{reverse,lines});
      return {id:edge.id,sources:[reverse?edge.target:edge.source],targets:[reverse?edge.source:edge.target],...(label?{labels:[label]}:{})};
    });
    const input={id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':policy.direction,'elk.edgeRouting':'ORTHOGONAL','elk.hierarchyHandling':'INCLUDE_CHILDREN','elk.spacing.nodeNode':String(policy.nodeGap||48),'elk.layered.spacing.nodeNodeBetweenLayers':String(policy.layerGap||84),'elk.spacing.edgeEdge':'18','elk.layered.nodePlacement.strategy':'NETWORK_SIMPLEX','elk.padding':'[top=36,left=36,bottom=36,right=36]'},children:[...groupNodes,...plain],edges};
    const output=await context.elk.layout(input),positioned=[],groups=[];
    function collect(parent,ox=0,oy=0){for(const child of parent.children||[]){const x=ox+child.x,y=oy+child.y;if(child.children){groups.push({...data.groups.find(g=>g.id===child.id),x,y,width:child.width,height:child.height});collect(child,x,y);}else positioned.push({...byId.get(child.id),x,y});}}
    collect(output);
    const routed=data.edges.map(edge=>{
      const out=output.edges.find(e=>e.id===edge.id),section=out?.sections?.[0];
      const container=groups.find(g=>g.id===out?.container),offset={x:container?.x||0,y:container?.y||0};
      let points;
      if(section)points=[section.startPoint,...section.bendPoints||[],section.endPoint].map(p=>({x:p.x+offset.x,y:p.y+offset.y}));
      else {
        const a=positioned.find(n=>n.id===edge.source),b=positioned.find(n=>n.id===edge.target);
        points=[{x:a.x+a.width/2,y:a.y+a.height},{x:b.x+b.width/2,y:b.y}];
      }
      if(labels.get(edge.id).reverse)points.reverse();
      const label=out?.labels?.[0];
      return {...edge,points,label:edge.label||'',labelLines:labels.get(edge.id).lines,labelBox:label?{x:label.x+offset.x,y:label.y+offset.y,width:label.width,height:label.height}:null};
    });
    return {width:output.width,height:output.height,nodes:positioned,edges:routed,groups,labels:[]};
  }
  U.GraphLayout=graph;
  if(typeof module==='object'&&module.exports)module.exports=graph;
})(globalThis);
