(function(){
  'use strict';
  // Fixed design fixture, deliberately independent of the production layout engines.
  const NS='http://www.w3.org/2000/svg',byId=id=>document.getElementById(id);
  const nodes=[
    {id:'road',name:'RoadVehicle',kind:'ABSTRACT CLASS',meta:'Parent of 3 vehicle classes',x:438,y:18},
    {id:'truck',name:'Truck',kind:'CLASS',meta:'Garage.Vehicles',x:90,y:164},
    {id:'car',name:'Car',kind:'CLASS',meta:'Garage.Vehicles',x:438,y:164},
    {id:'bus',name:'Bus',kind:'CLASS',meta:'Garage.Vehicles',x:786,y:164},
    {id:'truck-spec',name:'TruckSpecification',kind:'CLASS',meta:'Paired with Truck',x:90,y:320},
    {id:'car-spec',name:'CarSpecification',kind:'CLASS',meta:'2 association roles',x:438,y:320},
    {id:'bus-spec',name:'BusSpecification',kind:'CLASS',meta:'Paired with Bus',x:786,y:320},
    {id:'color',name:'VehicleColor',kind:'ENUM',meta:'Shared dependency',x:786,y:422}
  ].map(node=>({...node,y:node.y+(node.id==='color'?98:node.id.endsWith('-spec')?64:42)}));
  const relationships=[
    {id:'inherits-truck',from:'truck',to:'road',kind:'inheritance',label:'Truck inherits RoadVehicle'},
    {id:'inherits-car',from:'car',to:'road',kind:'inheritance',label:'Car inherits RoadVehicle'},
    {id:'inherits-bus',from:'bus',to:'road',kind:'inheritance',label:'Bus inherits RoadVehicle'},
    {id:'spec-truck',from:'truck',to:'truck-spec',kind:'association',label:'Truck → TruckSpecification',role:'specification'},
    {id:'spec-car-active',from:'car',to:'car-spec',kind:'association',label:'Car → CarSpecification',role:'activeSpecification'},
    {id:'spec-car-saved',from:'car',to:'car-spec',kind:'association',label:'Car → CarSpecification',role:'savedSpecification'},
    {id:'spec-bus',from:'bus',to:'bus-spec',kind:'association',label:'Bus → BusSpecification',role:'specification'},
    {id:'color-truck',from:'truck',to:'color',kind:'dependency',label:'Truck uses VehicleColor'},
    {id:'color-car',from:'car',to:'color',kind:'dependency',label:'Car uses VehicleColor'}
  ];
  const inherit=relationships.filter(r=>r.kind==='inheritance').map(r=>r.id),carSpecs=['spec-car-active','spec-car-saved'],colors=['color-truck','color-car'];
  const segment=(id,kind,members,points,marker=null)=>({id,kind,members,points,marker});
  function routes(bundled){
    const result=bundled?[
      segment('left-branch','inheritance',['inherits-truck'],[[182,164],[182,130],[530,130]]),
      segment('right-branch','inheritance',['inherits-bus'],[[878,164],[878,130],[530,130]]),
      segment('middle-branch','inheritance',['inherits-car'],[[530,164],[530,130]]),
      segment('parent-trunk','inheritance',inherit,[[530,130],[530,94]],'inheritance-arrow')
    ]:[
      segment('inherit-truck','inheritance',['inherits-truck'],[[182,164],[182,115],[512,115],[512,94]],'inheritance-arrow'),
      segment('inherit-car','inheritance',['inherits-car'],[[530,164],[530,94]],'inheritance-arrow'),
      segment('inherit-bus','inheritance',['inherits-bus'],[[878,164],[878,145],[548,145],[548,94]],'inheritance-arrow')
    ];
    result.push(segment('truck-spec','association',['spec-truck'],[[182,240],[182,320]]),segment('bus-spec','association',['spec-bus'],[[878,240],[878,320]]));
    if(bundled)result.push(segment('car-spec-pair','association',carSpecs,[[530,240],[530,320]]));
    else result.push(segment('car-spec-active','association',[carSpecs[0]],[[518,240],[518,320]]),segment('car-spec-saved','association',[carSpecs[1]],[[542,240],[542,320]]));
    if(bundled)result.push(
      segment('truck-color-branch','dependency',[colors[0]],[[90,202],[36,202],[36,288],[702,288]]),
      segment('car-color-branch','dependency',[colors[1]],[[622,202],[702,202],[702,288]]),
      segment('shared-color-trunk','dependency',colors,[[702,288],[750,288],[750,460],[786,460]],'dependency-arrow')
    );
    else result.push(
      segment('truck-color','dependency',[colors[0]],[[90,202],[36,202],[36,278],[738,278],[738,450],[786,450]],'dependency-arrow'),
      segment('car-color','dependency',[colors[1]],[[622,202],[690,202],[690,298],[762,298],[762,472],[786,472]],'dependency-arrow')
    );
    const support={
      'truck-color-branch':[[90,244],[36,244],[36,336],[702,336]],
      'car-color-branch':[[622,244],[702,244],[702,336]],
      'shared-color-trunk':[[702,336],[1030,336],[1030,558],[970,558]],
      'truck-color':[[90,244],[36,244],[36,326],[1020,326],[1020,548],[970,548]],
      'car-color':[[622,244],[690,244],[690,346],[1040,346],[1040,570],[970,570]]
    };
    return result.map(edge=>({...edge,points:edge.kind==='dependency'?support[edge.id]:edge.points.map(([x,y])=>[x,y+(edge.kind==='inheritance'?42:y===240?42:64)])}));
  }
  let bundled=true,selection=null;
  function svg(tag,attributes={},text){const element=document.createElementNS(NS,tag);for(const [name,value] of Object.entries(attributes))element.setAttribute(name,value);if(text!==undefined)element.textContent=text;return element;}
  function actionable(element,action){element.addEventListener('click',event=>{event.stopPropagation();action();});element.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();action();}});}
  function select(value){selection=value;render();}
  function selectedRelationships(){if(!selection)return [];return selection.node?relationships.filter(r=>r.from===selection.node||r.to===selection.node):relationships.filter(r=>selection.members.includes(r.id));}
  function renderCards(active,related){
    const layer=byId('cards');layer.replaceChildren();
    for(const node of nodes){
      const selected=selection?.node===node.id,dim=active&&!related.has(node.id);
      const group=svg('g',{class:'card'+(selected?' is-selected':'')+(dim?' is-dimmed':'')+(node.id==='color'?' support':''),transform:`translate(${node.x} ${node.y})`,tabindex:'0',role:'button','aria-label':'Select '+node.name,'aria-pressed':String(selected),'data-node-id':node.id});
      group.append(svg('title',{},node.name+' — select to trace its relationships'),svg('rect',{x:0,y:3,width:184,height:76,rx:9,class:'card-shadow'}),svg('rect',{width:184,height:76,rx:9,class:'card-body'}),svg('rect',{x:13,y:14,width:3,height:11,rx:1.5,class:'card-stripe'}),svg('text',{x:23,y:23,class:'card-kind'},node.kind),svg('text',{x:14,y:45,class:'card-name'},node.name),svg('text',{x:14,y:62,class:'card-meta'},node.meta));
      actionable(group,()=>select({node:node.id}));layer.append(group);
    }
  }
  function renderRoutes(active,selectedIds){
    const layer=byId('connections');layer.replaceChildren();
    for(const edge of routes(bundled)){
      const selected=edge.members.some(id=>selectedIds.has(id)),dim=active&&!selected;
      const names=edge.members.map(id=>relationships.find(r=>r.id===id)).map(r=>r.label+(r.role?' · '+r.role:'')).join('; ');
      const group=svg('g',{class:'connection '+edge.kind+(selected?' is-active':'')+(dim?' is-dimmed':''),tabindex:'0',role:'button','aria-label':names,'data-member-ids':edge.members.join(' ')});
      const d=edge.points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ');
      group.append(svg('title',{},names),svg('path',{d,class:'path-halo'}),svg('path',{d,class:'path-line',...(edge.marker?{'marker-end':'url(#'+edge.marker+')'}:{})}),svg('path',{d,class:'path-hit'}));
      actionable(group,()=>select({members:edge.members,title:edge.members.length>1?'Shared '+edge.kind+' path':'Individual '+edge.kind}));layer.append(group);
    }
  }
  function badge(layer,x,y,label,members,title,selectedIds,active){
    const dim=active&&!members.some(id=>selectedIds.has(id));
    const group=svg('g',{class:'route-badge'+(dim?' is-dimmed':''),tabindex:0,role:'button','aria-label':title,transform:`translate(${x} ${y})`});
    const width=label.length*5.8+20;group.append(svg('rect',{x:-width/2,y:-11,width,height:22,rx:11}),svg('text',{'text-anchor':'middle',y:3.5},label));actionable(group,()=>select({members,title}));layer.append(group);
  }
  function renderNotes(active,selectedIds){
    const layer=byId('route-notes');layer.replaceChildren();
    if(bundled){badge(layer,590,150,'3 inherit',inherit,'Shared inheritance trunk',selectedIds,active);badge(layer,584,308,'2 roles',carSpecs,'Two association roles',selectedIds,active);badge(layer,1030,494,'2 uses',colors,'Shared VehicleColor dependency',selectedIds,active);}
    else{layer.append(svg('text',{x:565,y:305,class:'route-note'},'individual roles'),svg('text',{x:565,y:321,class:'route-note'},'separate lanes'));}
    const x=288,y=318;layer.append(svg('rect',{x:x-5,y:y-11,width:176,height:16,rx:3,class:'route-note-bg'}),svg('text',{x,y,class:'crossing-note'},'Crossing only · no connection'));
  }
  function renderInspector(selected){
    const heading=byId('selection-heading'),description=byId('selection-description'),list=byId('relationship-list');list.replaceChildren();
    if(!selection){heading.textContent='Explore a connection';description.textContent='Select a class or a line. Shared paths keep every relationship available.';return;}
    heading.textContent=selection.node?nodes.find(n=>n.id===selection.node).name:selection.title;
    description.textContent=selected.length+' relationship'+(selected.length===1?'':'s')+'. '+(selection.node?'The complete incident paths are emphasised.':'Each relationship keeps its own meaning and identity.');
    for(const relation of selected){const li=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('small');title.textContent=relation.label;detail.textContent=relation.kind+(relation.role?' · '+relation.role:'');li.append(title,detail);list.append(li);}
  }
  function render(){
    const selected=selectedRelationships(),active=!!selection,ids=new Set(selected.map(r=>r.id)),related=new Set(selected.flatMap(r=>[r.from,r.to]));if(selection?.node)related.add(selection.node);
    byId('bundled').setAttribute('aria-pressed',String(bundled));byId('separate').setAttribute('aria-pressed',String(!bundled));byId('mode-description').textContent=bundled?'Shared trunks · individual meanings':'Independent paths · ordered parallel lanes';
    renderRoutes(active,ids);renderNotes(active,ids);renderCards(active,related);renderInspector(selected);
  }
  byId('bundled').addEventListener('click',()=>{bundled=true;render();});byId('separate').addEventListener('click',()=>{bundled=false;render();});byId('clear-selection').addEventListener('click',()=>select(null));
  byId('diagram').addEventListener('click',()=>select(null));document.addEventListener('keydown',event=>{if(event.key==='Escape')select(null);});render();
})();
