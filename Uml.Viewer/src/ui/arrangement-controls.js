(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  function create(api){
    const d=root.document,$=id=>d.getElementById(id),layers={nodes:$('nodes-layer'),groups:$('groups-layer'),edges:$('edges-layer')};let busy=false;
    const allowed=()=>api.enabled()&&!busy;
    function update(){
      const enabled=api.enabled();$('arrangement-controls').hidden=!enabled;if(!enabled)return;const state=U.Arrangement.ensure(api.state());
      for(const id of ['save-arrangement','load-arrangement','auto-arrange','reset-layout'])$(id).disabled=busy;
      $('undo-layout').disabled=busy||!state.layoutUndo.length;$('redo-layout').disabled=busy||!state.layoutRedo.length;
      const pins=[...state.positions.values()].filter(p=>p.pinned).length;
      $('arrangement-status').textContent=busy?'Arranging…':pins?pins+' pinned · auto-arrange keeps their positions':'Drag the ⠿ handles to arrange';
    }
    async function change(action,{auto=false,fit=auto}={}){
      if(!allowed())return false;const state=api.state(),before=U.Arrangement.snapshot(state);busy=true;update();
      try{action(state);if(auto)U.Arrangement.auto(state);const okay=await api.render();if(!okay){U.Arrangement.restore(state,before);return false;}U.Arrangement.checkpoint(state,before);if(fit)api.fit();return true;}
      catch(error){U.Arrangement.restore(state,before);api.error(error,'arrangement');return false;}
      finally{busy=false;update();}
    }
    async function history(redo){
      if(!allowed())return;const state=api.state(),changed=redo?U.Arrangement.redo(state):U.Arrangement.undo(state);if(!changed)return;
      busy=true;update();try{await api.render();}finally{busy=false;update();}
    }
    function dragHandle(id,kind,name){
      const button=U.Painter.html(d,'button','node-drag-handle','⠿');button.type='button';button.dataset.dragId=id;button.dataset.dragKind=kind;
      button.setAttribute('aria-label','Move '+name);button.title='Drag to move · arrow keys move 10px · Alt for 1px';return button;
    }
    const dragging=U.ArrangementDrag.create({viewport:$('viewport'),getScene:api.scene,getState:api.state,getZoom:()=>api.camera().zoom,enabled:allowed,
      preview(){const scene=api.scene();U.EdgeRouter.scene(scene,{fast:true});U.Painter.updatePositions(layers,scene,{inspect:api.inspect});api.highlight?.();$('world').style.width=scene.width+'px';$('world').style.height=scene.height+'px';},
      commit(ended){const scene=U.Arrangement.apply(api.scene(),api.state(),{repair:true});api.draw(scene);update();if(ended){const handle=[...$('world').querySelectorAll('[data-drag-id]')].find(button=>button.dataset.dragId===ended.id&&button.dataset.dragKind===ended.kind);handle?.focus({preventScroll:true});}}
    });
    function pinNode(id){if(!allowed())return;const state=api.state(),before=U.Arrangement.snapshot(state);U.Arrangement.pin(api.scene(),state,id);U.Arrangement.checkpoint(state,before);api.draw(api.scene());}
    function pinGroup(id){if(!allowed())return;const state=api.state(),before=U.Arrangement.snapshot(state);U.Arrangement.groupPin(api.scene(),state,id);U.Arrangement.checkpoint(state,before);api.draw(api.scene());}
    function saveRaw(){if(!api.enabled())throw new Error('Open a structural diagram before saving its arrangement.');U.Arrangement.capture(api.scene(),api.state());return JSON.stringify(U.Arrangement.serialize(api.document(),api.view(),api.state(),api.camera()),null,2)+'\n';}
    async function loadRaw(raw){
      if(!api.enabled()){api.error(new Error('Open the matching class, component or aggregation diagram before loading its arrangement.'),'arrangement');return false;}if(!allowed())return false;let parsed;
      try{parsed=U.Arrangement.parse(raw,api.document(),api.view());}catch(error){api.error(error,'arrangement');return false;}
      const okay=await change(state=>U.Arrangement.restore(state,parsed.state));
      if(okay&&parsed.camera)api.restoreCamera(parsed.camera);
      if(okay){$('error-panel').hidden=true;$('arrangement-status').textContent=parsed.ignored?'Arrangement loaded · '+parsed.ignored+' removed objects ignored':'Arrangement loaded';}return okay;
    }
    $('save-arrangement').addEventListener('click',()=>{
      if(!allowed())return;const url=URL.createObjectURL(new Blob([saveRaw()],{type:'application/json'})),a=U.Painter.html(d,'a');a.href=url;a.download=api.view().id+'.layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    $('load-arrangement').addEventListener('click',()=>{if(allowed())$('arrangement-file').click();});
    $('arrangement-file').addEventListener('change',async()=>{const file=$('arrangement-file').files[0];$('arrangement-file').value='';if(!file)return;if(file.size>1024*1024){api.error(new Error('Maximum arrangement size is 1 MB.'),'arrangement');return;}const doc=api.document(),view=api.view(),raw=await file.text();if(doc===api.document()&&view===api.view())await loadRaw(raw);});
    $('undo-layout').addEventListener('click',()=>history(false));$('redo-layout').addEventListener('click',()=>history(true));
    $('auto-arrange').addEventListener('click',()=>change(()=>{}, {auto:true}));$('reset-layout').addEventListener('click',()=>change(state=>U.Arrangement.reset(state),{fit:true}));
    d.addEventListener('keydown',event=>{if(!api.enabled()||!event.ctrlKey&&!event.metaKey||event.target.closest?.('input,textarea,select,[contenteditable=true]'))return;if(event.key.toLowerCase()==='z'){event.preventDefault();history(event.shiftKey);}else if(event.key.toLowerCase()==='y'){event.preventDefault();history(true);}});
    return {update,change,dragHandle,pinNode,pinGroup,saveRaw,loadRaw,undo:()=>history(false),redo:()=>history(true),cancel:()=>dragging.cancel()};
  }
  U.ArrangementControls={create};if(typeof module==='object'&&module.exports)module.exports=U.ArrangementControls;
})(globalThis);
