(function(root){
  'use strict';const U=root.UmlViewer,document=root.document,$=id=>document.getElementById(id);
  const viewport=$('viewport'),world=$('world'),status=$('layout-status'),html=(tag,className,text)=>U.Painter.html(document,tag,className,text);
  const glyphs={class:'C',aggregation:'◇',component:'▣',sequence:'⇣',communication:'↔',activity:'⑂'};
  const elk=typeof root.ELK==='function'?new root.ELK():null;
  const measure=U.Measure.createMeasurer(document),camera={x:0,y:0,zoom:1};
  let session=null,scene=null,view=null,mode='diagram',importTicket=0,drawTicket=0,fitted=true;
  let selection=null,history=[];
  const bounds=()=>({width:viewport.clientWidth||1000,height:viewport.clientHeight||580});
  function currentState(){return session.states.get(view.id);}
  function saveCamera(){if(session&&view&&scene)currentState().camera={...camera,fitted};}
  function restoreCamera(saved){camera.x=saved.x;camera.y=saved.y;camera.zoom=saved.zoom;}
  function transform(){world.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`;$('zoom-value').textContent=Math.round(camera.zoom*100)+'%';saveCamera();}
  function fit(automatic=false){if(!scene)return;const {width,height}=bounds();camera.zoom=Math.max(automatic ? (scene.nodes.length <= 12 && (scene.interaction?.messages.length || 0) <= 12 ? 0.55 : 0.8) : 0.06,Math.min(1.1,(width-60)/scene.width,(height-60)/scene.height));camera.x=scene.width*camera.zoom>width?26:(width-scene.width*camera.zoom)/2;camera.y=scene.height*camera.zoom>height?28:(height-scene.height*camera.zoom)/2;fitted=true;transform();}
  function zoom(zoomValue,x=bounds().width/2,y=bounds().height/2){const value=Math.min(3,Math.max(.06,zoomValue)),ratio=value/camera.zoom;camera.x=x-(x-camera.x)*ratio;camera.y=y-(y-camera.y)*ratio;camera.zoom=value;fitted=false;transform();}
  function stateFor(candidate,id){if(!candidate.states.has(id))candidate.states.set(id,{open:new Map(),reveal:new Set(),camera:null});return candidate.states.get(id);}
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
    $('view-id').textContent=view.id;
    const testIds=new Set(diagramTestItems().flatMap(([,item])=>item.tests||[]));$('tests-button').textContent='Tests · '+testIds.size;
    $('view-subtitle').textContent=({class:'Explore classes, their details and the relationships between them.',aggregation:'See the whole, its parts and the connections that bring them together.',component:'Follow dependencies across the building blocks of a system.',sequence:'Follow a conversation, one message at a time.',communication:'A different perspective on the same shared interaction.',activity:'Follow actions and decisions, connected to the same classes and operations.'})[view.type];
    $('state-badge').textContent=session.example?'Example · version 1':'Local file · version 1';$('source-code').textContent=session.raw;
    const sources=$('source-file');sources.replaceChildren();sources.hidden=!session.project;$('source-label').textContent=session.project?'Project sources · read only':'Original JSON · read only';
    if(session.project){const combined=html('option','','Combined document (downloadable)');combined.value='';sources.append(combined);for(const path of session.project.sources.keys()){const option=html('option','',path);option.value=path;sources.append(option);}}
    renderNavigation();
    modeUI();
  }
  function renderNavigation(){
    const nav=$('view-nav'),types=new Map();nav.replaceChildren();
    for(const item of session.data.views){if(!types.has(item.type))types.set(item.type,[]);types.get(item.type).push(item);}
    for(const [type,items] of types){
      const open=session.navOpen.has(type),active=view.type===type,section=html('section','nav-type'+(active?' is-current':''));section.dataset.diagramType=type;
      const heading=html('button','nav-type-toggle');heading.type='button';heading.dataset.typeToggle=type;heading.setAttribute('aria-expanded',String(open));heading.setAttribute('aria-controls','nav-type-'+type);
      heading.append(html('span','nav-glyph',glyphs[type]),html('strong','nav-type-name',U.Contract.TYPES[type]+'s'),html('span','nav-type-count',items.length),html('span','nav-type-chevron',open?'⌄':'›'));
      if(active){const marker=html('span','nav-active-dot');marker.setAttribute('aria-label','Contains the current diagram');heading.append(marker);}
      heading.addEventListener('click',()=>{if(session.navOpen.has(type))session.navOpen.delete(type);else session.navOpen.add(type);renderNavigation();const replacement=[...nav.querySelectorAll('[data-type-toggle]')].find(b=>b.dataset.typeToggle===type);replacement?.focus();});
      const list=html('div','nav-type-items');list.id='nav-type-'+type;list.hidden=!open;
      for(const item of items){
        const button=html('button','nav-view');button.type='button';button.dataset.viewId=item.id;button.title=item.title+' · '+item.id;
        const label=html('span','nav-view-label');label.append(html('strong','',item.title),html('small','nav-diagram-id',item.id));button.append(label);
        if(item.id===view.id){button.setAttribute('aria-current','page');button.append(html('span','nav-view-current','Viewing'));}
        button.addEventListener('click',()=>selectView(item.id));list.append(button);
      }
      section.append(heading,list);nav.append(section);
    }
  }
  function draw(result){
    scene=result;world.style.width=scene.width+'px';world.style.height=scene.height+'px';
    U.Painter.draw(document,{groups:$('groups-layer'),nodes:$('nodes-layer'),edges:$('edges-layer')},scene,{toggle,inspect,selectObject,selectNode});
    highlight();
    $('view-caption').textContent=scene.caption;$('notice').hidden=!scene.notice;$('notice').textContent=scene.notice||'';$('canvas-empty').hidden=scene.nodes.length>0;
    $('element-count').textContent=scene.interaction?`${scene.nodes.length} participants · ${scene.interaction.messages.length} messages`:`${scene.nodes.length} elements · ${scene.edges.length} connections`;
    const legend=$('mini-legend');legend.replaceChildren();
    const symbols={dependency:'╌▷',association:'─',inheritance:'─▷',implementation:'╌▷',aggregation:'◇─',composition:'◆─',call:'→',reply:'⇢',alt:'alt'};
    for(const [kind,label] of scene.legend||[]){const entry=html('span');entry.append(html('b','',symbols[kind]||'→'),document.createTextNode(label));legend.append(entry);}
    status.textContent='';
  }
  async function loadText(raw,filename='document.json',example=false,ticket,project=null){
    const token=ticket??++importTicket;
    try{
      const data=U.Contract.parse(raw),candidate={data,raw,filename,example,project,states:new Map(),navOpen:new Set([data.views[0].type]),index:U.Connectivity.index(data)},selected=data.views[0];
      if(!elk)throw new Error('The local layout library is missing. Keep the vendor folder alongside index.html.');
      status.textContent='Arranging your diagram…';
      const result=await U.Renderers.get(selected.type).build(data,selected,context(candidate,selected));
      if(token!==importTicket)return false;
      saveCamera();++drawTicket;session=candidate;view=selected;scene=null;mode='diagram';selection=null;history=[];$('back-button').disabled=true;$('inspector').hidden=true;$('error-panel').hidden=true;$('element-search').value='';header();draw(result);fit(true);return true;
    }catch(e){if(token===importTicket){status.textContent='';error(e,filename);}return false;}
  }
  async function loadFile(file){
    const token=++importTicket;
    try{if(!file)throw new Error('Choose one JSON file.');if(file.size>4*1024*1024)throw new Error('Maximum file size is 4 MB.');if(!/\.json$/i.test(file.name))throw new Error('Choose a file ending in .json.');const raw=await file.text();if(token!==importTicket)return false;return loadText(raw,file.name,false,token);}catch(e){if(token===importTicket)error(e,file?.name||'file');return false;}
  }
  async function loadProject(input){
    const token=++importTicket;
    try{
      const files=[...input].filter(f=>f.name.endsWith('.json'));if(files.length>64)throw new Error('Select a project containing at most 64 JSON files.');
      if(files.some(f=>f.size>4*1024*1024)||files.reduce((n,f)=>n+f.size,0)>12*1024*1024)throw new Error('Project JSON exceeds the limit: 4 MB per file and 12 MB total.');
      const entries=await Promise.all(files.map(async f=>[f.webkitRelativePath||f.name,await f.text()]));if(token!==importTicket)return false;
      const sources=new Map(entries);if(sources.size!==entries.length)throw new Error('Duplicate source paths in this folder.');
      const manifests=[...sources.keys()].filter(path=>path.split('/').at(-1)==='uml.project.json');if(manifests.length!==1)throw new Error('Choose a folder containing exactly one uml.project.json manifest.');
      const project=U.Project.assemble(sources,manifests[0]);return loadText(JSON.stringify(project.document,null,2)+'\n',project.document.id+'.uml.json',false,token,project);
    }catch(e){if(token===importTicket)error(e,'UML project');return false;}
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
    saveCamera();view=selected;session.navOpen.add(selected.type);selection=null;const saved=stateFor(session,id).camera;$('inspector').hidden=true;$('element-search').value='';header();
    const changed=await render({resetCamera:!saved});if(changed&&saved){restoreCamera(saved);fitted=saved.fitted;transform();}return changed;
  }
  async function toggle(key,item,category='element'){
    if(!session||!view)return;const state=currentState(),p=U.Model.presentation(item,key,state,category);if(!p.collapsible)return;
    state.open.set(key,!p.open);return render({anchor:key});
  }
  function setMode(value){mode=value;modeUI();}
  function highlight(){
    for(const item of [...$('nodes-layer').querySelectorAll('.is-selected'),...$('edges-layer').querySelectorAll('.is-selected')])item.classList.remove('is-selected');
    if(!selection||!scene)return;
    const ids=new Set();
    for(const occurrence of U.Connectivity.matches(session.index,selection.objectId).direct.filter(o=>o.viewId===view.id)){
      if(['element','member'].includes(occurrence.kind))ids.add(occurrence.elementId);
      else if(occurrence.kind==='activity')ids.add(occurrence.localId);
      else for(const edge of scene.edges)if(edge.messages?.some(m=>m.id===occurrence.localId))for(const element of $('edges-layer').querySelectorAll('[data-edge-id]'))if(element.dataset.edgeId===edge.id)element.classList.add('is-selected');
    }
    for(const card of $('nodes-layer').querySelectorAll('[data-node-id]')){
      const node=scene.nodes.find(n=>n.id===card.dataset.nodeId);
      if(ids.has(card.dataset.nodeId)||(node?.kind==='collapsed-group'&&node.item.members.some(id=>ids.has(id))))card.classList.add('is-selected');
      for(const row of card.querySelectorAll('[data-object-id]'))row.classList.toggle('is-selected',row.dataset.objectId===selection.objectId);
    }
  }
  function selectObject(id){
    if(!session?.index.catalog.has(id))return;
    selection={objectId:id};const object=session.index.catalog.get(id),panel=$('inspector-content');panel.replaceChildren();$('inspector').hidden=false;$('inspector').scrollTop=0;
    panel.append(html('h3','',object.name),html('small','',object.kind+' · '+id));
    if(object.owner)panel.append(html('p','', 'Owned by '+session.index.catalog.get(object.owner).name));
    if(object.notes)panel.append(html('p','',object.notes));
    renderTests(panel,object);
    if(object.references?.length){panel.append(html('h4','','References'));referenceButtons(panel,object.references);}
    const matches=U.Connectivity.matches(session.index,id);
    for(const [label,items] of [['Also appears in',matches.direct],['Related through '+(object.owner?'owning class':'members'),matches.related]]){
      if(!items.length)continue;panel.append(html('h4','',label));
      const groups=new Map();for(const occurrence of items){if(!groups.has(occurrence.viewId))groups.set(occurrence.viewId,[]);groups.get(occurrence.viewId).push(occurrence);}
      const makeButton=occurrence=>{const button=html('button','occurrence-link');button.type='button';button.dataset.occurrenceKey=occurrence.key;
        button.append(html('strong','',occurrence.viewTitle+(occurrence.viewId===view.id?' · current':'')),html('small','',U.Contract.TYPES[occurrence.type]+' · '+occurrence.kind+' · '+occurrence.viewId),html('span','',occurrence.label));
        button.addEventListener('click',()=>navigateTo(occurrence.key,id));return button;
      };
      for(const entries of groups.values()){
        const ranked=entries.slice().sort((a,b)=>(a.kind==='member'&&a.type!=='class'?1:0)-(b.kind==='member'&&b.type!=='class'?1:0));
        panel.append(makeButton(ranked[0]));
        if(ranked.length>1){const details=html('details','more-occurrences'),summary=html('summary','',(ranked.length-1)+' more appearances in this view');details.append(summary,...ranked.slice(1).map(makeButton));panel.append(details);}
      }
    }
    if(!matches.direct.length)panel.append(html('p','', 'This object has no explicit appearances in the loaded views.'));
    highlight();
  }
  function referenceButtons(container,references){
    for(const id of references||[]){const object=session.index.catalog.get(id);if(!object)continue;const button=html('button','reference-link',object.name+' ↗');button.type='button';button.dataset.referenceId=id;button.addEventListener('click',()=>selectObject(id));container.append(button);}
  }
  function renderTests(container,item,label='Connected tests'){
    const section=html('section','test-links');section.append(html('h4','',label));
    if(!item.tests?.length)section.append(html('p','test-empty','No tests linked.'));
    else for(const id of item.tests){
      const test=session.data.tests[id],entry=html('article','test-reference');entry.dataset.testId=id;
      const name=html(test.url?'a':'strong','test-name',test.name);if(test.url){name.href=test.url;name.target='_blank';name.rel='noopener noreferrer';}entry.append(name,html('small','',(test.kind?test.kind+' · ':'')+id));
      if(test.file)entry.append(html('code','test-file',test.file));if(test.symbol)entry.append(html('code','test-symbol',test.symbol));if(test.notes)entry.append(html('p','',test.notes));section.append(entry);
    }
    section.append(html('small','test-note','Linked references · not test results'));container.append(section);
  }
  function diagramTestItems(){
    const items=[['Diagram tests',view]];if(view.interaction)items.push(['Interaction tests',session.data.interactions[view.interaction]]);if(view.activity)items.push(['Activity tests',session.data.activities[view.activity]]);return items;
  }
  function inspectDiagramTests(){
    if(!session)return;const panel=$('inspector-content');panel.replaceChildren();$('inspector').hidden=false;$('inspector').scrollTop=0;panel.append(html('h3','',view.title),html('small','',view.id));for(const [label,item] of diagramTestItems())renderTests(panel,item,label);
  }
  function selectNode(node){
    if(view.type!=='activity')return selectObject(node.sourceId);
    selection=null;highlight();
    const panel=$('inspector-content');panel.replaceChildren();$('inspector').hidden=false;panel.append(html('h3','',node.item.name));
    renderTests(panel,node.item);
    if(node.item.notes)panel.append(html('p','',node.item.notes));referenceButtons(panel,node.item.references);
    if(!node.item.references?.length)panel.append(html('p','', 'No shared object references on this step. Add references in JSON to connect it.'));
  }
  function remember(){saveCamera();history.push({viewId:view.id,camera:{...camera},fitted,mode,selection:selection&&{...selection},open:new Map(currentState().open),reveal:new Set(currentState().reveal)});if(history.length>50)history.shift();$('back-button').disabled=false;}
  async function navigateTo(key,objectId=selection?.objectId){
    const candidate=session,occurrence=session?.index.occurrences.find(o=>o.key===key);if(!occurrence)return false;
    const selected=session.data.views.find(v=>v.id===occurrence.viewId);remember();
    const state=stateFor(session,selected.id);
    const reveal=id=>{for(const group of session.data.groups||[])if(group.members.includes(id)){state.open.set('group:'+group.id,true);state.reveal.add('group:'+group.id);}state.open.set(id,true);state.reveal.add(id);};
    if(occurrence.elementId)reveal(occurrence.elementId);
    if(occurrence.kind==='message'){reveal(occurrence.from);reveal(occurrence.to);for(const parent of occurrence.parents){state.open.set(parent,true);state.reveal.add(parent);}}
    if(occurrence.kind==='activity')state.open.set(occurrence.localId,true);
    mode='diagram';if(!await selectView(selected.id)||session!==candidate||view.id!==selected.id)return false;
    const node=scene.nodes.find(n=>n.id===(occurrence.elementId||occurrence.localId));
    if(node){centerNode(node);const card=[...$('nodes-layer').querySelectorAll('[data-node-id]')].find(n=>n.dataset.nodeId===node.id);const member=[...card?.querySelectorAll('[data-object-id]')||[]].find(n=>n.dataset.objectId===occurrence.localId);member?.scrollIntoView?.({block:'nearest',inline:'nearest'});}
    else if(occurrence.kind==='message'){const edge=scene.edges.find(e=>e.messages?.some(m=>m.id===occurrence.localId));if(edge)centerNode(edge.labelBox||{...edge.points[0],width:1,height:1});}
    if(objectId)selectObject(objectId);if(node)centerNode(node);return true;
  }
  async function back(){
    const previous=history.pop(),candidate=session;if(!previous)return false;
    if(!await selectView(previous.viewId)||candidate!==session)return false;
    currentState().open=new Map(previous.open);currentState().reveal=new Set(previous.reveal);if(!await render()||candidate!==session)return false;
    restoreCamera(previous.camera);fitted=previous.fitted;mode=previous.mode;modeUI();transform();selection=previous.selection;
    if(selection)selectObject(selection.objectId);else $('inspector').hidden=true;$('back-button').disabled=!history.length;return true;
  }
  function inspect(edge){
    const panel=$('inspector-content');panel.replaceChildren();$('inspector').hidden=false;
    const title=html('h3','',edge.messages?.length?'Messages on this connection':edge.kind[0].toUpperCase()+edge.kind.slice(1));panel.append(title);
    const name=id=>session.data.elements[id]?.name||id;
    for(const value of edge.messages||edge.originals||[edge]){
      const item=html('article');item.append(html('small','',(value.number?value.number+' · ':'')+(value.kind||edge.kind)),html('p','',name(value.from)+' → '+name(value.to)));
      if(value.label)item.append(html('code','',value.label));
      if(value.guards?.length)item.append(html('p','',value.guards.map(g=>'['+g+']').join(' AND ')));
      item.append(html('small','',value.id));renderTests(item,value);referenceButtons(item,value.references);
      if(value.parents){const sequence=session.data.views.find(v=>v.type==='sequence'&&v.interaction===view.interaction);if(sequence){const button=html('button','secondary-button','View in sequence →');button.type='button';button.addEventListener('click',async()=>{
        const occurrence=session.index.occurrences.find(o=>o.viewId===sequence.id&&o.kind==='message'&&o.localId===value.id);
        if(occurrence)await navigateTo(occurrence.key,value.references?.[0]);centerEdge(value.id);
      });item.append(button);}}
      panel.append(item);
    }
  }
  function centerNode(node){const b=bounds(),panel=$('inspector'),pr=panel.hidden?null:panel.getBoundingClientRect?.(),vr=viewport.getBoundingClientRect();const width=pr&&pr.left<vr.right?Math.max(240,Math.min(b.width,pr.left-vr.left-24)):b.width;camera.zoom=1;camera.x=width/2-(node.x+node.width/2);camera.y=b.height/2-(node.y+node.height/2);fitted=false;transform();}
  function centerEdge(id){const edge=scene?.edges.find(e=>e.message?.id===id);if(!edge)return;const b=edge.labelBox;centerNode(b||{...edge.points[0],width:1,height:1});const group=$('edges-layer').querySelector(`[data-edge-id="message:${id}"]`);group?.classList.add('is-selected');}
  async function focus(query=$('element-search').value){
    if(!session||!query.trim())return;const candidate=session,selected=view,needle=query.trim().toLocaleLowerCase();
    if(view.type==='activity'){const node=scene.nodes.find(n=>[n.item.name,n.id,...(n.item.references||[]).flatMap(id=>[id,session.index.catalog.get(id)?.name||''])].some(s=>s.toLocaleLowerCase().includes(needle)));if(node){selectNode(node);centerNode(node);}else{$('notice').hidden=false;$('notice').textContent='No action matches “'+query+'” in this view.';}return;}
    const ids=['sequence','communication'].includes(view.type)?session.data.interactions[view.interaction].participants:view.elements;
    const member=[...session.index.catalog.values()].find(item=>item.owner&&ids.includes(item.owner)&&[item.id,item.name].some(value=>value.toLocaleLowerCase().includes(needle)));
    if(member){const occurrence=session.index.byObject.get(member.id)?.find(o=>o.viewId===view.id);if(occurrence)return navigateTo(occurrence.key,member.id);}
    const id=ids.find(id=>{const item=session.data.elements[id];return [id,item.name,item.display?.collapsed?.name,item.display?.expanded?.name].some(value=>value?.toLocaleLowerCase().includes(needle));});
    if(!id){$('notice').hidden=false;$('notice').textContent='No element matches “'+query+'” in this view.';return;}
    const state=currentState();for(const group of session.data.groups||[])if(group.members.includes(id))state.open.set('group:'+group.id,true);state.open.set(id,true);
    await render();if(candidate!==session||selected!==view)return;const node=scene.nodes.find(n=>n.id===id);if(node){centerNode(node);$('nodes-layer').querySelector(`[data-node-id="${id}"] .node-header`)?.focus();}
  }
  async function selectExample(id){const example=(U.Examples||[]).find(e=>e.id===id);if(example)return loadText(example.text,example.filename,true);}
  $('open-button').addEventListener('click',()=>$('file-input').click());
  $('project-button').addEventListener('click',()=>$('project-input').click());
  $('project-input').addEventListener('change',()=>{const files=[...$('project-input').files];$('project-input').value='';if(files.length)loadProject(files);});
  $('source-file').addEventListener('change',()=>{$('source-code').textContent=session.project?.sources.get($('source-file').value)||session.raw;});
  $('file-input').addEventListener('change',()=>{const file=$('file-input').files[0];$('file-input').value='';if(file)loadFile(file);});
  $('drop-zone').addEventListener('click',()=>$('file-input').click());$('drop-zone').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();$('file-input').click();}});
  let dragDepth=0;
  document.addEventListener('dragenter',event=>{if([...event.dataTransfer?.types||[]].includes('Files')){event.preventDefault();dragDepth++;$('drop-overlay').hidden=false;}});
  document.addEventListener('dragover',event=>{if([...event.dataTransfer?.types||[]].includes('Files'))event.preventDefault();});
  document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('drop-overlay').hidden=true;}});
  document.addEventListener('drop',event=>{event.preventDefault();dragDepth=0;$('drop-overlay').hidden=true;const files=[...event.dataTransfer?.files||[]];if(files.length!==1){error(new Error('Drop one JSON document at a time.'));return;}loadFile(files[0]);});
  $('diagram-tab').addEventListener('click',()=>setMode('diagram'));$('json-tab').addEventListener('click',()=>setMode('source'));
  $('tests-button').addEventListener('click',inspectDiagramTests);
  $('back-button').addEventListener('click',()=>back());
  $('zoom-in').addEventListener('click',()=>zoom(camera.zoom*1.2));$('zoom-out').addEventListener('click',()=>zoom(camera.zoom/1.2));$('fit-button').addEventListener('click',()=>fit());$('actual-button').addEventListener('click',()=>zoom(1));
  $('reset-button').addEventListener('click',()=>{if(!session)return;currentState().open.clear();currentState().reveal.clear();$('element-search').value='';render({resetCamera:true});});
  $('element-search').addEventListener('keydown',event=>{if(event.key==='Enter')focus();});
  $('dismiss-error').addEventListener('click',()=>$('error-panel').hidden=true);$('close-inspector').addEventListener('click',()=>$('inspector').hidden=true);
  $('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('workbench').requestFullscreen();}catch{};if(fitted)fit(true);});
  $('download-button').addEventListener('click',()=>{if(!session)return;const path=mode==='source'?$('source-file').value:null,raw=session.project?.sources.get(path)||session.raw;const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=html('a');a.href=url;a.download=path?.split('/').at(-1)||session.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
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
  U.App={loadText,loadFile,loadProject,selectExample,selectView,toggle,setMode,focus,fit,zoom,selectObject,navigateTo,back,getState:()=>({document:session?.data,filename:session?.filename,raw:session?.raw,project:session?.project,view,scene,mode,camera:{...camera},selection,index:session?.index,historyLength:history.length,open:session&&view?new Map(currentState().open):new Map()})};
  selectExample('bicycle-aggregation');
})(globalThis);
