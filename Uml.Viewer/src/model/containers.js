(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  // Explicit groups retain their meaning. Only explicit namespace metadata creates namespace facts.
  function document(source,view){
    const groups=(source.groups||[]).map(g=>({...g,members:[...g.members]})),assigned=new Set(groups.flatMap(g=>g.members)),pending=new Map();
    for(const id of view.elements||[]){if(assigned.has(id))continue;const namespace=source.elements[id].namespace||'',key='namespace:'+namespace;
      if(!pending.has(key))pending.set(key,{id:key,name:namespace||'Unassigned / global',kind:'namespace',members:[],display:{initial:'expanded'}});
      pending.get(key).members.push(id);
    }
    return {...source,groups:[...groups,...pending.values()]};
  }
  function prepare(source,view,state){const data=U.Model.structural(document(source,view),view,state);for(const group of data.groups){group.presentation.show.add('count');group.container=true;}return data;}
  function reframe(scene){
    for(const group of scene.groups){const members=scene.nodes.filter(n=>n.groupId===group.id);if(!members.length)continue;
      const padding=group.routingPadding||{left:28,right:28,bottom:28};group.x=Math.max(0,Math.min(...members.map(n=>n.x))-padding.left);group.y=Math.max(0,Math.min(...members.map(n=>n.y))-(group.headerHeight||64));
      group.width=Math.max(group.minimumWidth||260,Math.max(...members.map(n=>n.x+n.width))+padding.right-group.x);group.height=Math.max(...members.map(n=>n.y+n.height))+padding.bottom-group.y;
    }
    scene.width=Math.max(600,...scene.nodes.map(n=>n.x+n.width+40),...scene.groups.map(g=>g.x+g.width+40));scene.height=Math.max(300,...scene.nodes.map(n=>n.y+n.height+40),...scene.groups.map(g=>g.y+g.height+40));return scene;
  }
  function settle(scene){
    reframe(scene);const placed=[],overlap=(a,b)=>a.x<b.x+b.width+28&&a.x+a.width+28>b.x&&a.y<b.y+b.height+28&&a.y+a.height+28>b.y;
    const fixed=g=>scene.nodes.some(n=>n.groupId===g.id&&n.pinned);
    for(const group of [...scene.groups].sort((a,b)=>Number(fixed(b))-Number(fixed(a))||a.y-b.y||a.x-b.x)){
      let hit,attempts=0;while((hit=placed.find(other=>overlap(group,other)))&&attempts++<60){
        if(fixed(group)){scene.arrangementNotice='Pinned namespace containers overlap. Move or unpin their cards to make room.';break;}
        const dy=hit.y+hit.height+76-group.y;group.y+=dy;for(const node of scene.nodes)if(node.groupId===group.id)node.y+=dy;
      }placed.push(group);
    }
    return reframe(scene);
  }
  U.Containers={document,prepare,reframe,settle};
})(globalThis);
