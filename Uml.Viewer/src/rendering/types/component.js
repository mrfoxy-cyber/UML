(function(root){
  'use strict';const U=root.UmlViewer;
  U.Renderers.register('component',{async build(document,view,context){
    const data=U.Model.structural(document,view,context.state);
    const scene=await U.GraphLayout(data,context,{direction:'RIGHT',nodeGap:60,layerGap:116});
    return {...scene,caption:'Components and explicit dependencies. Arrows point toward the component being used; groups organize related components.',legend:[['dependency','Depends on'],['association','Connected to']]};
  }});
})(globalThis);
