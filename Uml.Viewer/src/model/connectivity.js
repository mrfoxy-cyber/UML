(function(root){
  'use strict';const U=root.UmlViewer;
  function index(document){
    const catalog=new Map(),occurrences=[],byObject=new Map();
    for(const [id,item] of Object.entries(document.elements)){
      catalog.set(id,{...item,id});
      for(const member of item.members||[])if(typeof member==='object')catalog.set(member.id,{...member,owner:id});
    }
    function add(view,kind,localId,label,references,extra={}){
      const occurrence={key:JSON.stringify([view.id,kind,localId]),viewId:view.id,type:view.type,viewTitle:view.title,kind,localId,label,references:[...new Set(references)],...extra};
      occurrences.push(occurrence);
      for(const id of occurrence.references){if(!byObject.has(id))byObject.set(id,[]);byObject.get(id).push(occurrence);}
    }
    for(const view of document.views){
      if(view.type==='activity'){
        for(const node of document.activities[view.activity].nodes)add(view,'activity',node.id,node.name,node.references||[]);
        continue;
      }
      const participants=view.interaction?document.interactions[view.interaction].participants:view.elements;
      for(const id of participants){
        const item=document.elements[id];add(view,'element',id,item.name,[id,...item.references||[]],{elementId:id});
        if(view.type!=='communication')for(const member of item.members||[])if(typeof member==='object')add(view,'member',member.id,member.name,[member.id],{elementId:id});
      }
      if(view.interaction)for(const message of U.Model.interaction(document,view.interaction).messages)add(view,'message',message.id,message.number+' · '+message.label,message.references||[],{from:message.from,to:message.to,parents:message.parents});
    }
    return {catalog,occurrences,byObject};
  }
  function matches(index,id){
    const object=index.catalog.get(id);if(!object)return {direct:[],related:[]};
    const direct=index.byObject.get(id)||[],keys=new Set(direct.map(o=>o.key));
    const relatedIds=object.owner?[object.owner]:[...index.catalog.values()].filter(item=>item.owner===id).map(item=>item.id);
    const related=new Map();for(const relatedId of relatedIds)for(const occurrence of index.byObject.get(relatedId)||[])if(!keys.has(occurrence.key))related.set(occurrence.key,occurrence);
    return {direct,related:[...related.values()]};
  }
  U.Connectivity={index,matches};
  if(typeof module==='object'&&module.exports)module.exports=U.Connectivity;
})(globalThis);
