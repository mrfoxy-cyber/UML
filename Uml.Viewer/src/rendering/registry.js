(function(root){
  'use strict';const U=root.UmlViewer ||= {},renderers=new Map();
  U.Renderers={register(type,renderer){if(renderers.has(type))throw Error('Duplicate renderer '+type);renderers.set(type,renderer);},get(type){if(!renderers.has(type))throw Error('No renderer for '+type);return renderers.get(type);},types(){return [...renderers.keys()];}};
  if(typeof module==='object'&&module.exports)module.exports=U.Renderers;
})(globalThis);
