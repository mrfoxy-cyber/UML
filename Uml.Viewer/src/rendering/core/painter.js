(function(root){
  'use strict';const U=root.UmlViewer;
  const NS='http://www.w3.org/2000/svg';
  function html(document,tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function svg(document,tag,attributes={}){const node=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));return node;}
  function draw(document,layers,scene,actions){
    const {groups,nodes,edges}=layers;groups.replaceChildren();nodes.replaceChildren();edges.replaceChildren();
    edges.setAttribute('viewBox',`0 0 ${scene.width} ${scene.height}`);edges.setAttribute('width',scene.width);edges.setAttribute('height',scene.height);
    const defs=svg(document,'defs');
    for(const [id,path,filled] of [['arrow','M1 1 L9 5 L1 9',false],['triangle','M1 1 L10 6 L1 11 Z',true],['diamond','M1 6 L7 1 L13 6 L7 11 Z',true],['filled-diamond','M1 6 L7 1 L13 6 L7 11 Z',true]]){
      const marker=svg(document,'marker',{id:'uml-'+id,viewBox:id==='arrow'?'0 0 10 10':'0 0 14 12',refX:id.includes('diamond')?13:id==='triangle'?10:9,refY:id==='arrow'?5:6,markerWidth:13,markerHeight:12,orient:'auto-start-reverse',markerUnits:'userSpaceOnUse'});
      marker.append(svg(document,'path',{d:path,fill:filled?(id==='filled-diamond'?'var(--edge)':'var(--surface)'):'none',stroke:'var(--edge)','stroke-width':1.5}));defs.append(marker);
    }edges.append(defs);
    for(const line of scene.lifelines||[])edges.append(svg(document,'line',{x1:line.x,x2:line.x,y1:line.y,y2:line.bottom,class:'lifeline'}));
    for(const group of scene.groups){
      const box=html(document,'section','diagram-group'+(group.fragment?' fragment':''));Object.assign(box.style,{left:group.x+'px',top:group.y+'px',width:group.width+'px',height:group.height+'px'});
      const p=group.presentation,button=html(document,'button','group-title');button.type='button';button.disabled=!p.collapsible;button.setAttribute('aria-expanded',String(p.open));
      button.setAttribute('aria-label',(p.open?'Collapse ':'Expand ')+p.name);button.dataset.actionId=group.key;
      button.title=p.name;
      if(group.fragment)button.append(html(document,'span','group-tab','alt'));
      if(p.show.has('name'))button.append(html(document,'span','group-name',p.name));
      if(p.show.has('count'))button.append(html(document,'span','group-count',group.count+(group.fragment?' paths':' elements')));
      if(p.collapsible)button.append(html(document,'span','group-toggle',p.open?'−':'+'));
      button.addEventListener('click',()=>actions.toggle(group.key,group.item,group.fragment?'fragment':'group'));box.append(button);
      if(group.noteHeight){const note=html(document,'div','group-note',group.item.notes);note.style.maxHeight=group.noteHeight+'px';note.tabIndex=0;box.append(note);}
      groups.append(box);
    }
    for(const label of scene.labels||[]){
      if(label.separator)edges.append(svg(document,'line',{x1:label.x-8,x2:label.x+label.width,y1:label.y-12,y2:label.y-12,class:'branch-separator'}));
      const text=svg(document,'text',{x:label.x,y:label.y+13,class:'guard-label'});label.lines.forEach((line,i)=>{const span=svg(document,'tspan',{x:label.x,dy:i?17:0});span.textContent=line;text.append(span);});edges.append(text);
    }
    for(const edge of scene.edges){
      const group=svg(document,'g',{class:'edge-group'+(edge.context?' is-context':''),tabindex:0,role:'button','aria-label':edge.kind+': '+(edge.label||edge.id)});
      group.dataset.edgeId=edge.id;
      const d=edge.points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');
      const attributes={d,class:'edge-line kind-'+edge.kind};
      if(['inheritance','implementation'].includes(edge.kind))attributes['marker-end']='url(#uml-triangle)';
      else if(['aggregation','composition'].includes(edge.kind))attributes['marker-start']='url(#uml-'+(edge.kind==='aggregation'?'diamond':'filled-diamond')+')';
      else if(edge.kind!=='association')attributes['marker-end']='url(#uml-arrow)';
      group.append(svg(document,'path',{d,class:'edge-hit'}),svg(document,'path',attributes));
      if(edge.labelBox&&edge.labelLines?.length){
        const b=edge.labelBox;group.append(svg(document,'rect',{x:b.x-2,y:b.y-1,width:b.width+4,height:b.height+2,rx:5,class:'edge-label-background'}));
        const text=svg(document,'text',{x:b.x+8,y:b.y+17,class:'edge-label'});edge.labelLines.forEach((line,i)=>{const span=svg(document,'tspan',{x:b.x+8,dy:i?17:0});span.textContent=line;text.append(span);});group.append(text);
      }
      for(const [textValue,at] of [[edge.fromMultiplicity,edge.points[0]],[edge.toMultiplicity,edge.points.at(-1)]])if(textValue){const text=svg(document,'text',{x:at.x+10,y:at.y-9,class:'multiplicity'});text.textContent=textValue;group.append(text);}
      const title=svg(document,'title');title.textContent=edge.proxy?'Grouped connection: '+edge.originals.map(o=>o.from+' → '+o.to).join(', '):edge.label||edge.kind;group.append(title);
      group.addEventListener('click',()=>actions.inspect(edge));group.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();actions.inspect(edge);}});edges.append(group);
    }
    for(const node of scene.nodes){
      const p=node.presentation,card=html(document,'article','uml-node node-'+node.kind+(p.open?' is-open':'')+(node.emphasis?' is-whole':'')+(node.context?' is-context':''));card.dataset.nodeId=node.id;
      Object.assign(card.style,{left:node.x+'px',top:node.y+'px',width:node.width+'px',height:node.height+'px'});
      if(['decision','merge'].includes(node.kind)){const shape=svg(document,'svg',{viewBox:'0 0 260 170',class:'decision-shape','aria-hidden':true});shape.append(svg(document,'polygon',{points:'130,2 258,85 130,168 2,85'}));card.append(shape);}
      const header=html(document,'button','node-header');header.type='button';header.disabled=!p.collapsible;header.style.height=node.headerHeight+'px';header.setAttribute('aria-label',(p.open?'Collapse ':'Expand ')+p.name);header.setAttribute('aria-expanded',String(p.open));
      header.title=p.name;
      if(node.kind==='actor'){
        const actor=svg(document,'svg',{viewBox:'0 0 32 54',class:'actor-icon','aria-hidden':true});actor.append(svg(document,'circle',{cx:16,cy:8,r:6}),svg(document,'path',{d:'M16 14 V34 M3 22 H29 M16 34 L4 51 M16 34 L28 51'}));header.append(actor);
      }
      const names=html(document,'span','node-names');
      if(p.show.has('kind'))names.append(html(document,'span','node-kind',node.kind==='interface'?'«interface»':node.kind==='collapsed-group'?'Group':node.kind));
      if(p.show.has('name'))names.append(html(document,'span','node-name',p.name));
      header.append(names);if(p.collapsible)header.append(html(document,'span','node-toggle',p.open?'−':'+'));
      header.addEventListener('click',()=>actions.toggle(node.id,node.item,node.kind==='collapsed-group'?'group':'element'));card.append(header);
      if(node.kind!=='collapsed-group'&&actions.selectNode&&(!scene.activity||node.item.references?.length||node.item.tests?.length)){const link=html(document,'button','node-connect','↗');link.type='button';link.setAttribute('aria-label','Connected views for '+node.item.name);link.title='Connected views and tests';link.addEventListener('click',()=>actions.selectNode(node));card.append(link);}
      if(node.rows.length){
        const body=html(document,'div','node-body');body.tabIndex=0;body.setAttribute('aria-label',p.name+' details');body.style.maxHeight=(node.height-node.headerHeight)+'px';
        for(const row of node.rows){const line=html(document,row.objectId?'button':'div','node-row'+(row.muted?' muted':''),row.text);if(row.objectId){line.type='button';line.dataset.objectId=row.objectId;line.title='Find this member in other views';line.addEventListener('click',()=>actions.selectObject?.(row.objectId));}body.append(line);}card.append(body);
      }
      nodes.append(card);
    }
  }
  U.Painter={draw,html,svg};
  if(typeof module==='object'&&module.exports)module.exports=U.Painter;
})(globalThis);
