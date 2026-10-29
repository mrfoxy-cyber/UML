(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  function presentation(item,key,state,category='element'){
    const config=item.display||{};
    const open=state.open.has(key)?state.open.get(key):config.initial?config.initial==='expanded':category==='group';
    const mode=open?'expanded':'collapsed';
    const defaults=category==='group'?(open?['name','count','members']:['name','count']):category==='fragment'?(open?['name','steps']:['name','count']):(open?['name','kind','members','notes']:['name','kind','count']);
    const show=new Set(config[mode]?.show||defaults);if(open&&state.reveal?.has(key))show.add(category==='fragment'?'steps':'members');
    return {open,collapsible:config.collapsible!==false,name:config[mode]?.name||item.name||'Alternatives',show};
  }
  function interaction(document,id){
    const source=document.interactions[id],messages=[],fragments=[];
    function walk(steps,prefix='',guards=[],parents=[]){let n=0;for(const step of steps){const number=prefix+ ++n;if(step.kind==='alt'){fragments.push(step);step.branches.forEach((branch,i)=>walk(branch.steps,number+'.'+(i+1)+'.',[...guards,branch.guard],[...parents,'fragment:'+id+':'+step.id]));}else messages.push({...step,number,guards,parents});}}
    walk(source.steps);return {...source,id,messages,fragments};
  }
  function structural(document,view,state){
    const selected=new Set(view.elements),nodes=[],groups=[],redirect=new Map();
    const elementGroups=new Map();
    for(const group of document.groups||[]){
      const members=group.members.filter(id=>selected.has(id));if(!members.length)continue;
      const key='group:'+group.id,p=presentation(group,key,state,'group');
      if(!p.open||!p.show.has('members')){
        nodes.push({id:key,sourceId:group.id,item:group,kind:'collapsed-group',presentation:p,count:members.length,memberNames:members.map(id=>document.elements[id].name),groupId:null});
        members.forEach(id=>redirect.set(id,key));
      }else{
        groups.push({id:'frame:'+group.id,sourceId:group.id,key,item:group,presentation:p,count:members.length});
        members.forEach(id=>elementGroups.set(id,'frame:'+group.id));
      }
    }
    for(const id of view.elements)if(!redirect.has(id)){
      const item=document.elements[id];nodes.push({id,sourceId:id,item,kind:item.kind,presentation:presentation(item,id,state),groupId:elementGroups.get(id)||null});
    }
    const edges=[],summaries=new Map();
    for(const relation of document.relationships||[]){
      if(!selected.has(relation.from)||!selected.has(relation.to))continue;
      if(view.type==='aggregation'&&relation.kind!=='aggregation')continue;
      const from=redirect.get(relation.from)||relation.from,to=redirect.get(relation.to)||relation.to;
      if(from===to&&redirect.has(relation.from))continue;
      const proxy=from!==relation.from||to!==relation.to;
      const edge={...relation,source:from,target:to,originals:[relation],proxy};
      if(proxy){const key=from+'|'+to+'|'+relation.kind;if(summaries.has(key))summaries.get(key).originals.push(relation);else{summaries.set(key,edge);edges.push(edge);}}
      else edges.push(edge);
    }
    for(const edge of edges)if(edge.proxy)edge.label=edge.originals.length>1?edge.originals.length+' '+edge.kind+' relationships':`${document.elements[edge.from].name} → ${document.elements[edge.to].name}`;
    return {nodes,groups,edges};
  }
  U.Model={presentation,interaction,structural};
  if(typeof module==='object'&&module.exports)module.exports=U.Model;
})(globalThis);
