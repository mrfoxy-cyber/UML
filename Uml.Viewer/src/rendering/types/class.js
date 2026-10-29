(function(root){
  'use strict';const U=root.UmlViewer;
  U.Renderers.register('class',{async build(document,view,context){
    const data=U.Model.structural(document,view,context.state);
    const hierarchy=data.edges.some(edge=>['inheritance','implementation'].includes(edge.kind));
    const direction=hierarchy||context.viewport.width<context.viewport.height?'DOWN':'RIGHT';
    const scene=await U.GraphLayout(data,context,{direction,inheritanceUp:true,nodeGap:48,layerGap:92});
    return {...scene,caption:'Classes and their relationships. Open a card for its selected details; hollow triangles point to the parent or interface.',legend:[['inheritance','Inherits'],['implementation','Implements'],['dependency','Depends on'],['association','Association']]};
  }});
})(globalThis);
