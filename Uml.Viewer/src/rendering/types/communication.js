(function(root){
  'use strict';const U=root.UmlViewer;
  U.Renderers.register('communication',{async build(document,view,context){
    const interaction=U.Model.interaction(document,view.interaction),links=new Map();
    for(const message of interaction.messages){
      const key=message.from+'|'+message.to+'|'+message.kind;
      if(!links.has(key))links.set(key,{id:'link:'+key,kind:message.kind,from:message.from,to:message.to,messages:[]});
      links.get(key).messages.push(message);
    }
    const relationships=[...links.values()].map(link=>({...link,label:`${link.messages[0].number}${link.messages.length>1?' … '+link.messages.at(-1).number:''} · ${link.messages.length} ${link.kind}${link.messages.length===1?'':'s'}`}));
    const data=U.Model.structural({...document,relationships},{...view,elements:interaction.participants},context.state);
    for(const node of data.nodes){
      const sources=node.kind==='collapsed-group'?node.item.members:[node.sourceId];
      node.messages=interaction.messages.filter(m=>sources.includes(m.from)).map(m=>`${m.number}  ${m.kind}: ${m.label} → ${document.elements[m.to].name}${m.guards.length?' ['+m.guards.join(' · ')+']':''}`);
      if(node.kind!=='collapsed-group')node.count=node.messages.length;
    }
    for(const edge of data.edges)edge.messages=edge.originals.flatMap(o=>o.messages||[]);
    const scene=await U.GraphLayout(data,context,{direction:'RIGHT',nodeGap:72,layerGap:120});
    return {...scene,interaction,caption:'The same interaction, arranged around its collaborators. Open a participant for numbered outgoing messages; select a connection to inspect calls, replies and guards.',legend:[['call','Calls'],['reply','Replies']]};
  }});
})(globalThis);
