(function(root){
  'use strict';const U=root.UmlViewer;
  U.Renderers.register('component',{async build(document,view,context){
    const data=U.Containers.prepare(document,view,context.state);
    const scene=await U.ContainerLayout.layout(data,context,context.state.layoutAlgorithm||'elk');scene.coordinated=true;scene.routingMode=context.state.routingMode||'bundled';U.EdgeRouter.scene(scene);
    return {...scene,caption:'Components and explicit dependencies. Arrows point toward the component being used; groups organize related components.',legend:[['dependency','Depends on'],['association','Connected to']]};
  }});
})(globalThis);
