(function(root){
  'use strict';const U=root.UmlViewer,document=root.document,$=id=>document.getElementById(id);
  const viewport=$('viewport'),world=$('world'),status=$('layout-status'),html=(tag,className,text)=>U.Painter.html(document,tag,className,text);
  const glyphs={class:'C',aggregation:'◇',component:'▣',sequence:'⇣',communication:'↔'};
  const elk=typeof root.ELK==='function'?new root.ELK():null;
  const measure=U.Measure.createMeasurer(document),camera={x:0,y:0,zoom:1};
  let session=null,scene=null,view=null,mode='diagram',importTicket=0,drawTicket=0,fitted=true;
  const bounds=()=>({width:viewport.clientWidth||1000,height:viewport.clientHeight||580});
  function currentState(){return session.states.get(view.id);}
  function saveCamera(){if(session&&view&&scene)currentState().camera={...camera,fitted};}
  function transform(){world.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`;$('zoom-value').textContent=Math.round(camera.zoom*100)+'%';saveCamera();}
  function fit(automatic=false){if(!scene)return;const {width,height}=bounds();camera.zoom=Math.max(automatic ? (scene.nodes.length <= 12 && (scene.interaction?.messages.length || 0) <= 12 ? 0.55 : 0.8) : 0.06,Math.min(1.1,(width-60)/scene.width,(height-60)/scene.height));camera.x=scene.width*camera.zoom>width?26:(width-scene.width*camera.zoom)/2;camera.y=scene.height*camera.zoom>height?28:(height-scene.height*camera.zoom)/2;fitted=true;transform();}
  function zoom(zoomValue,x=bounds().width/2,y=bounds().height/2){const value=Math.min(3,Math.max(.06,zoomValue)),ratio=value/camera.zoom;camera.x=x-(x-camera.x)*ratio;camera.y=y-(y-camera.y)*ratio;camera.zoom=value;fitted=false;transform();}
  function stateFor(candidate,id){if(!candidate.states.has(id))candidate.states.set(id,{open:new Map(),camera:null});return candidate.states.get(id);}
  function context(candidate,selected){return {elk,measure,viewport:bounds(),state:stateFor(candidate,selected.id)};}
  function error(errorValue,filename='JSON document'){
    $('error-title').textContent='Could not open '+filename;$('error-message').textContent=errorValue.message||String(errorValue);$('error-path').textContent=errorValue.path||'';$('error-panel').hidden=false;
  }
  function modeUI(){
    const source=mode==='source';viewport.hidden=source;$('source-panel').hidden=!source;$('search-toolbar').hidden=source;$('zoom-controls').hidden=source;
    $('diagram-tab').setAttribute('aria-pressed',String(!source));$('json-tab').setAttribute('aria-pressed',String(source));$('canvas-hint').textContent=source?'Read only · edit your file and open it again':'↔ Drag to pan · Scroll to zoom';
  }
  function header(){
    $('document-name').textContent=session.data.title;$('file-name').textContent=session.filename;$('view-count').textContent=session.data.views.length;
    $('view-title').textContent=view.title;$('type-label').textContent=U.Contract.TYPES[view.type].toUpperCase();$('origin-label').textContent=session.example?'EXAMPLE':'YOUR JSON';
    $('view-subtitle').textContent=({class:'Explore classes, their details and the relationships between them.',aggregation:'See the whole, its parts and the connections that bring them together.',component:'Follow dependencies across the building blocks of a system.',sequence:'Follow a conversation, one message at a time.',communication:'A different perspective on the same shared interaction.'})[view.type];
    $('state-badge').textContent=session.example?'Example · version 1':'Local file · version 1';$('source-code').textContent=session.raw;
    const nav=$('view-nav');nav.replaceChildren();
    for(const item of session.data.views){const button=html('button','nav-view');button.type='button';button.dataset.viewId=item.id;if(item.id===view.id)button.setAttribute('aria-current','page');button.append(html('span','nav-glyph',glyphs[item.type]),(()=>{const text=html('span');text.append(html('strong','',item.title),html('small','',U.Contract.TYPES[item.type]));return text;})());button.addEventListener('click',()=>selectView(item.id));nav.append(button);}
    modeUI();
  }
  function draw(result){
    scene=result;world.style.width=scene.width+'px';world.style.height=scene.height+'px';
    U.Painter.draw(document,{groups:$('groups-layer'),nodes:$('nodes-layer'),edges:$('edges-layer')},scene,{toggle,inspect});
    $('view-caption').textContent=scene.caption;$('notice').hidden=!scene.notice;$('notice').textContent=scene.notice||'';$('canvas-empty').hidden=scene.nodes.length>0;
    $('element-count').textContent=scene.interaction?`${scene.nodes.length} participants · ${scene.interaction.messages.length} messages`:`${scene.nodes.length} elements · ${scene.edges.length} connections`;
    const legend=$('mini-legend');legend.replaceChildren();
    const symbols={dependency:'╌▷',association:'─',inheritance:'─▷',implementation:'╌▷',aggregation:'◇─',composition:'◆─',call:'→',reply:'⇢',alt:'alt'};
    for(const [kind,label] of scene.legend||[]){const entry=html('span');entry.append(html('b','',symbols[kind]||'→'),document.createTextNode(label));legend.append(entry);}
    status.textContent='';
  }
  async function loadText(raw,filename='document.json',example=false,ticket){
    const token=ticket??++importTicket;
    try{
      const data=U.Contract.parse(raw),candidate={data,raw,filename,example,states:new Map()},selected=data.views[0];
      if(!elk)throw new Error('The local layout library is missing. Keep the vendor folder alongside index.html.');
      status.textContent='Arranging your diagram…';
      const result=await U.Renderers.get(selected.type).build(data,selected,context(candidate,selected));
      if(token!==importTicket)return false;
      saveCamera();++drawTicket;session=candidate;view=selected;scene=null;mode='diagram';$('inspector').hidden=true;$('error-panel').hidden=true;$('element-search').value='';header();draw(result);fit(true);return true;
    }catch(e){if(token===importTicket){status.textContent='';error(e,filename);}return false;}
  }
  async function loadFile(file){
    const token=++importTicket;
    try{if(!file)throw new Error('Choose one JSON file.');if(file.size>4*1024*1024)throw new Error('Maximum file size is 4 MB.');if(!/\.json$/i.test(file.name))throw new Error('Choose a file ending in .json.');const raw=await file.text();if(token!==importTicket)return false;return loadText(raw,file.name,false,token);}catch(e){if(token===importTicket)error(e,file?.name||'file');return false;}
  }
  async function render({resetCamera=false,anchor=null}={}){
    if(!session||!view)return false;
    const ticket=++drawTicket,candidate=session,selected=view,old=anchor&&scene?[...scene.nodes,...scene.groups].find(n=>n.id===anchor||n.key===anchor):null;
    const screen=old?{x:old.x*camera.zoom+camera.x,y:old.y*camera.zoom+camera.y}:null;
    status.textContent='Arranging diagram…';
    try{
      const result=await U.Renderers.get(selected.type).build(candidate.data,selected,context(candidate,selected));
      if(ticket!==drawTicket||session!==candidate||view!==selected)return false;
      draw(result);
      if(resetCamera)fit(true);
      else if(screen){const next=[...scene.nodes,...scene.groups].find(n=>n.id===anchor||n.key===anchor);if(next){camera.x=screen.x-next.x*camera.zoom;camera.y=screen.y-next.y*camera.zoom;}fitted=false;transform();}
      else transform();
      return true;
    }catch(e){if(ticket===drawTicket){status.textContent='Could not arrange this view.';error(e,'diagram');}return false;}
  }
  async function selectView(id){
    if(!session)return false;const selected=session.data.views.find(v=>v.id===id);if(!selected)return false;
    saveCamera();view=selected;const saved=stateFor(session,id).camera;$('inspector').hidden=true;$('element-search').value='';header();
    const changed=await render({resetCamera:!saved});if(changed&&saved){Object.assign(camera,saved);fitted=saved.fitted;transform();}return changed;
  }
  async function toggle(key,item,category='element'){
    if(!session||!view)return;const state=currentState(),p=U.Model.presentation(item,key,state,category);if(!p.collapsible)return;
    state.open.set(key,!p.open);return render({anchor:key});
  }
  function setMode(value){mode=value;modeUI();}
  function inspect(edge){
    const panel=$('inspector-content');panel.replaceChildren();$('inspector').hidden=false;
    const title=html('h3','',edge.messages?.length?'Messages on this connection':edge.kind[0].toUpperCase()+edge.kind.slice(1));panel.append(title);
    const name=id=>session.data.elements[id]?.name||id;
    for(const value of edge.messages||edge.originals||[edge]){
      const item=html('article');item.append(html('small','',(value.number?value.number+' · ':'')+(value.kind||edge.kind)),html('p','',name(value.from)+' → '+name(value.to)));
      if(value.label)item.append(html('code','',value.label));
      if(value.guards?.length)item.append(html('p','',value.guards.map(g=>'['+g+']').join(' AND ')));
      item.append(html('small','',value.id));
      if(value.parents){const sequence=session.data.views.find(v=>v.type==='sequence'&&v.interaction===view.interaction);if(sequence){const button=html('button','secondary-button','View in sequence →');button.type='button';button.addEventListener('click',async()=>{
        const candidate=session;const state=stateFor(candidate,sequence.id);for(const parent of value.parents)state.open.set(parent,true);
        await selectView(sequence.id);if(candidate!==session||view.id!==sequence.id)return;centerEdge(value.id);$('inspector').hidden=true;
      });item.append(button);}}
      panel.append(item);
    }
  }
  function centerNode(node){const b=bounds();camera.zoom=1;camera.x=b.width/2-(node.x+node.width/2);camera.y=b.height/2-(node.y+node.height/2);fitted=false;transform();}
  function centerEdge(id){const edge=scene?.edges.find(e=>e.message?.id===id);if(!edge)return;const b=edge.labelBox;centerNode(b||{...edge.points[0],width:1,height:1});const group=$('edges-layer').querySelector(`[data-edge-id="message:${id}"]`);group?.classList.add('is-selected');}
  async function focus(query=$('element-search').value){
    if(!session||!query.trim())return;const candidate=session,selected=view,needle=query.trim().toLocaleLowerCase();
    const ids=['sequence','communication'].includes(view.type)?session.data.interactions[view.interaction].participants:view.elements;
    const id=ids.find(id=>{const item=session.data.elements[id];return [id,item.name,item.display?.collapsed?.name,item.display?.expanded?.name].some(value=>value?.toLocaleLowerCase().includes(needle));});
    if(!id){$('notice').hidden=false;$('notice').textContent='No element matches “'+query+'” in this view.';return;}
    const state=currentState();for(const group of session.data.groups||[])if(group.members.includes(id))state.open.set('group:'+group.id,true);state.open.set(id,true);
    await render();if(candidate!==session||selected!==view)return;const node=scene.nodes.find(n=>n.id===id);if(node){centerNode(node);$('nodes-layer').querySelector(`[data-node-id="${id}"] .node-header`)?.focus();}
  }
  async function selectExample(id){const example=(U.Examples||[]).find(e=>e.id===id);if(example)return loadText(example.text,example.filename,true);}
  $('open-button').addEventListener('click',()=>$('file-input').click());
  $('file-input').addEventListener('change',()=>{const file=$('file-input').files[0];$('file-input').value='';if(file)loadFile(file);});
  $('drop-zone').addEventListener('click',()=>$('file-input').click());$('drop-zone').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();$('file-input').click();}});
  let dragDepth=0;
  document.addEventListener('dragenter',event=>{if([...event.dataTransfer?.types||[]].includes('Files')){event.preventDefault();dragDepth++;$('drop-overlay').hidden=false;}});
  document.addEventListener('dragover',event=>{if([...event.dataTransfer?.types||[]].includes('Files'))event.preventDefault();});
  document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('drop-overlay').hidden=true;}});
  document.addEventListener('drop',event=>{event.preventDefault();dragDepth=0;$('drop-overlay').hidden=true;const files=[...event.dataTransfer?.files||[]];if(files.length!==1){error(new Error('Drop one JSON document at a time.'));return;}loadFile(files[0]);});
  $('diagram-tab').addEventListener('click',()=>setMode('diagram'));$('json-tab').addEventListener('click',()=>setMode('source'));
  $('zoom-in').addEventListener('click',()=>zoom(camera.zoom*1.2));$('zoom-out').addEventListener('click',()=>zoom(camera.zoom/1.2));$('fit-button').addEventListener('click',()=>fit());$('actual-button').addEventListener('click',()=>zoom(1));
  $('reset-button').addEventListener('click',()=>{if(!session)return;currentState().open.clear();$('element-search').value='';render({resetCamera:true});});
  $('element-search').addEventListener('keydown',event=>{if(event.key==='Enter')focus();});
  $('dismiss-error').addEventListener('click',()=>$('error-panel').hidden=true);$('close-inspector').addEventListener('click',()=>$('inspector').hidden=true);
  $('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('workbench').requestFullscreen();}catch{};if(fitted)fit(true);});
  $('download-button').addEventListener('click',()=>{if(!session)return;const url=URL.createObjectURL(new Blob([session.raw],{type:'application/json'})),a=html('a');a.href=url;a.download=session.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('guide-button').addEventListener('click',()=>{if($('guide-dialog').showModal)$('guide-dialog').showModal();else $('guide-dialog').setAttribute('open','');});$('close-guide').addEventListener('click',()=>{if($('guide-dialog').close)$('guide-dialog').close();else $('guide-dialog').removeAttribute('open');});
  let dark=false;try{dark=localStorage.getItem('uml-viewer-theme')==='dark';}catch{};if(dark)document.documentElement.dataset.theme='dark';
  $('theme-button').addEventListener('click',()=>{dark=!dark;document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('uml-viewer-theme',dark?'dark':'light');}catch{}});
  viewport.addEventListener('wheel',event=>{if(event.target.closest?.('.node-body'))return;event.preventDefault();const b=viewport.getBoundingClientRect();zoom(camera.zoom*Math.exp(-event.deltaY*.0014),event.clientX-b.left,event.clientY-b.top);},{passive:false});
  const pointers=new Map();let gesture=null,scroll=null;
  viewport.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;const body=event.target.closest?.('.node-body');if(body&&event.pointerType==='touch'){scroll={id:event.pointerId,body,y:event.clientY,top:body.scrollTop};return;}
    if(event.target.closest?.('button,.uml-node,.edge-group,.node-body'))return;
    viewport.setPointerCapture?.(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});startGesture();
  });
  function startGesture(){const list=[...pointers.values()];gesture={list,camera:{...camera},center:list.length>1?{x:(list[0].x+list[1].x)/2,y:(list[0].y+list[1].y)/2}:list[0],distance:list.length>1?Math.hypot(list[0].x-list[1].x,list[0].y-list[1].y):0};}
  viewport.addEventListener('pointermove',event=>{
    if(scroll?.id===event.pointerId){scroll.body.scrollTop=scroll.top+scroll.y-event.clientY;return;}
    if(!pointers.has(event.pointerId)||!gesture)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const list=[...pointers.values()];
    if(list.length===1){camera.x=gesture.camera.x+list[0].x-gesture.center.x;camera.y=gesture.camera.y+list[0].y-gesture.center.y;}
    else{const center={x:(list[0].x+list[1].x)/2,y:(list[0].y+list[1].y)/2},distance=Math.hypot(list[0].x-list[1].x,list[0].y-list[1].y),b=viewport.getBoundingClientRect();camera.zoom=Math.max(.06,Math.min(3,gesture.camera.zoom*distance/gesture.distance));const ratio=camera.zoom/gesture.camera.zoom;camera.x=center.x-b.left-(gesture.center.x-b.left-gesture.camera.x)*ratio;camera.y=center.y-b.top-(gesture.center.y-b.top-gesture.camera.y)*ratio;}
    fitted=false;transform();
  });
  for(const kind of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(kind,event=>{if(scroll?.id===event.pointerId)scroll=null;pointers.delete(event.pointerId);if(pointers.size)startGesture();else gesture=null;});
  viewport.addEventListener('keydown',event=>{if(event.target!==viewport)return;const moves={ArrowLeft:[35,0],ArrowRight:[-35,0],ArrowUp:[0,35],ArrowDown:[0,-35]};if(moves[event.key]){event.preventDefault();camera.x+=moves[event.key][0];camera.y+=moves[event.key][1];fitted=false;transform();}else if(['+','=','-','0','f','F'].includes(event.key)){event.preventDefault();if(['0','f','F'].includes(event.key))fit();else zoom(camera.zoom*(event.key==='-'?1/1.15:1.15));}});
  if(root.ResizeObserver)new root.ResizeObserver(()=>{if(scene&&mode==='diagram'&&fitted)fit(true);}).observe(viewport);
  for(const example of U.Examples||[]){const button=html('button','example-button');button.type='button';button.append(html('span','',glyphs[example.type]||'◇'),document.createTextNode(example.label));button.addEventListener('click',()=>selectExample(example.id));$('example-list').append(button);}
  U.App={loadText,loadFile,selectExample,selectView,toggle,setMode,focus,fit,zoom,getState:()=>({document:session?.data,filename:session?.filename,raw:session?.raw,view,scene,mode,camera:{...camera},open:session&&view?new Map(currentState().open):new Map()})};
  selectExample('bicycle-aggregation');
})(globalThis);
