(function(root){
  'use strict';const U=root.UmlViewer;
  U.Renderers.register('activity',{async build(document,view,context){
    const activity=document.activities[view.activity];
    const nodes=activity.nodes.map(item=>{const presentation=U.Model.presentation(item,item.id,context.state);if(item.kind!=='action'){presentation.collapsible=false;presentation.show=new Set(['name']);}return {id:item.id,sourceId:item.id,item,kind:item.kind,presentation};});
    const edges=activity.flows.map(flow=>({...flow,id:'flow:'+flow.id,kind:'flow',source:flow.from,target:flow.to,label:flow.guard?'['+flow.guard+']':'',originals:[flow]}));
    const scene=await U.GraphLayout({nodes,edges,groups:[]},context,{direction:'DOWN',nodeGap:64,layerGap:66});
    // ELK routes to rectangular bounds; trim symbol endpoints to their actual outlines.
    const byId=new Map(scene.nodes.map(n=>[n.id,n]));
    for(const edge of scene.edges)for(const [id,i,j] of [[edge.source,0,1],[edge.target,edge.points.length-1,edge.points.length-2]]){
      const node=byId.get(id),point=edge.points[i],next=edge.points[j],cx=node.x+node.width/2,cy=node.y+node.height/2;
      if(['decision','merge'].includes(node.kind)){
        if(Math.abs(point.x-next.x)<.1)point.y=cy+Math.sign(point.y-cy)*node.height/2*(1-Math.abs(point.x-cx)/(node.width/2));
        else point.x=cx+Math.sign(point.x-cx)*node.width/2*(1-Math.abs(point.y-cy)/(node.height/2));
      }else if(['initial','final'].includes(node.kind)){
        const r=node.kind==='final'?13:11,dx=next.x-cx,dy=next.y-cy,length=Math.hypot(dx,dy)||1;point.x=cx+dx/length*r;point.y=cy+dy/length*r;
      }
    }
    return {...scene,activity,caption:'Follow the guarded flow. Use an action’s ↗ button to find its class or operation in other diagrams.',legend:[['flow','Control flow']]};
  }});
})(globalThis);
