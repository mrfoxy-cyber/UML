(function(root){
  'use strict';const U=root.UmlViewer;
  U.Renderers.register('aggregation',{async build(document,view,context){
    const data=U.Containers.prepare(document,view,context.state);
    const wholes=new Set(data.edges.filter(e=>e.kind==='aggregation').map(e=>e.source));
    data.nodes=data.nodes.map(node=>({...node,emphasis:wholes.has(node.id)}));
    const scene=await U.ContainerLayout.layout(data,context,context.state.layoutAlgorithm||'elk');scene.coordinated=true;scene.routingMode=context.state.routingMode||'bundled';U.EdgeRouter.scene(scene);
    const hasRelationships=(document.relationships||[]).some(r=>r.kind==='aggregation'&&view.elements.includes(r.from)&&view.elements.includes(r.to));
    return {...scene,caption:'Whole–part relationships. The hollow diamond belongs to the whole; its parts can exist independently.',notice:hasRelationships?'':'This view has no aggregation relationships. Add a relationship with kind "aggregation".',legend:[['aggregation','Whole ◇ — part']]};
  }});
})(globalThis);
