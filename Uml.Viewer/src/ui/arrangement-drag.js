(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  function create({viewport,getScene,getState,getZoom,enabled,preview,commit}){
    let drag=null;
    function begin(id,kind,clientX,clientY,pointerId){
      const scene=getScene(),state=getState();U.Arrangement.capture(scene,state);
      const group=kind==='group'?scene.groups.find(g=>g.sourceId===id):null;
      const nodes=group?scene.nodes.filter(n=>n.groupId===group.id):kind==='collapsed-group'?scene.nodes.filter(n=>n.kind==='collapsed-group'&&n.sourceId===id):scene.nodes.filter(n=>n.id===id);if(!nodes.length)return null;
      return {id,kind,pointerId,x:clientX,y:clientY,dx:0,dy:0,before:U.Arrangement.snapshot(state),nodes:nodes.map(n=>({node:n,x:n.x,y:n.y})),groups:scene.groups.map(g=>({group:g,x:g.x,y:g.y,width:g.width,height:g.height}))};
    }
    function move(dx,dy){
      if(!drag)return;const minX=Math.min(...drag.nodes.map(n=>n.x)),minY=Math.min(...drag.nodes.map(n=>n.y));
      drag.dx=Math.max(24-minX,dx);drag.dy=Math.max((drag.kind==='group'?84:24)-minY,dy);
      if(drag.kind==='node'&&getScene().coordinated){const node=drag.nodes[0].node,group=getScene().groups.find(g=>g.id===node.groupId);if(group){const p=group.routingPadding||{left:28,right:28,bottom:28};drag.dx=Math.max(group.x+p.left-minX,Math.min(drag.dx,group.x+group.width-p.right-node.width-minX));drag.dy=Math.max(group.y+(group.headerHeight||64)-minY,Math.min(drag.dy,group.y+group.height-p.bottom-node.height-minY));}}
      for(const value of drag.nodes){value.node.x=value.x+drag.dx;value.node.y=value.y+drag.dy;}
      U.Arrangement.reframe(getScene());preview(drag.nodes.map(value=>value.node));
    }
    function finish(cancelled=false){
      if(!drag)return;const ended=drag;drag=null;
      if(cancelled){for(const value of ended.nodes){value.node.x=value.x;value.node.y=value.y;}U.Arrangement.reframe(getScene());commit(null);return;}
      if(Math.abs(ended.dx)+Math.abs(ended.dy)<1){commit(null);return;}
      const state=getState();U.Arrangement.checkpoint(state,ended.before);
      for(const value of ended.nodes)state.positions.set(value.node.id,{x:value.node.x,y:value.node.y,pinned:true});
      if(ended.kind==='group'||ended.kind==='collapsed-group'){
        const offset=state.groupOffsets.get(ended.id)||{dx:0,dy:0};state.groupOffsets.set(ended.id,{dx:offset.dx+ended.dx,dy:offset.dy+ended.dy});
        const group=getScene().groups.find(g=>g.sourceId===ended.id)||getScene().nodes.find(n=>n.kind==='collapsed-group'&&n.sourceId===ended.id);
        for(const member of group?.item.members||[])if(!ended.nodes.some(value=>value.node.id===member)&&state.positions.has(member)){const p=state.positions.get(member);state.positions.set(member,{...p,x:p.x+ended.dx,y:p.y+ended.dy});}
      }
      commit(ended);
    }
    viewport.addEventListener('pointerdown',event=>{
      if(event.button!==0||!enabled())return;const handle=event.target.closest?.('[data-drag-id]');if(!handle)return;
      event.preventDefault();event.stopPropagation();drag=begin(handle.dataset.dragId,handle.dataset.dragKind,event.clientX,event.clientY,event.pointerId);if(!drag)return;
      viewport.setPointerCapture?.(event.pointerId);viewport.classList.add('is-moving-node');
    },true);
    viewport.addEventListener('pointermove',event=>{if(drag?.pointerId===event.pointerId){event.preventDefault();move((event.clientX-drag.x)/getZoom(),(event.clientY-drag.y)/getZoom());}},true);
    viewport.addEventListener('pointerup',event=>{if(drag?.pointerId===event.pointerId){event.preventDefault();finish();viewport.classList.remove('is-moving-node');try{viewport.releasePointerCapture?.(event.pointerId);}catch{}}},true);
    for(const kind of ['pointercancel','lostpointercapture'])viewport.addEventListener(kind,event=>{if(drag?.pointerId===event.pointerId){finish(true);viewport.classList.remove('is-moving-node');}},true);
    viewport.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&drag){event.preventDefault();finish(true);viewport.classList.remove('is-moving-node');return;}
      const handle=event.target.closest?.('[data-drag-id]');if(!handle||!enabled())return;
      const step=event.altKey?1:event.shiftKey?40:10,delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];if(!delta)return;
      event.preventDefault();drag=begin(handle.dataset.dragId,handle.dataset.dragKind,0,0,null);move(...delta);finish();
    },true);
    return {cancel(){finish(true);viewport.classList.remove('is-moving-node');},get active(){return !!drag;}};
  }
  U.ArrangementDrag={create};if(typeof module==='object'&&module.exports)module.exports=U.ArrangementDrag;
})(globalThis);
