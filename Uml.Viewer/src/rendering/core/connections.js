(function(root){
  'use strict';
  const U=root.UmlViewer ||= {};
  const pathData=points=>points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');
  const safeColor=value=>typeof value==='string'&&/^#[\da-f]{3,8}$/i.test(value)?value:'var(--accent)';

  // Round only the overview cable. UML terminal geometry remains exact.
  function roundedPath(points,radius=10){
    if(points.length<3)return pathData(points);
    let result='M'+points[0].x+' '+points[0].y;
    for(let i=1;i<points.length-1;i++){
      const previous=points[i-1],corner=points[i],next=points[i+1];
      const before=Math.hypot(corner.x-previous.x,corner.y-previous.y);
      const after=Math.hypot(next.x-corner.x,next.y-corner.y);
      const cross=(corner.x-previous.x)*(next.y-corner.y)-(corner.y-previous.y)*(next.x-corner.x);
      if(before<.1||after<.1||Math.abs(cross)<.1){result+=' L'+corner.x+' '+corner.y;continue;}
      const r=Math.min(radius,before/2,after/2);
      const a={x:corner.x+(previous.x-corner.x)*r/before,y:corner.y+(previous.y-corner.y)*r/before};
      const b={x:corner.x+(next.x-corner.x)*r/after,y:corner.y+(next.y-corner.y)*r/after};
      result+=' L'+a.x+' '+a.y+' Q'+corner.x+' '+corner.y+' '+b.x+' '+b.y;
    }
    const last=points.at(-1);return result+' L'+last.x+' '+last.y;
  }

  function draw(document,layer,scene,actions){
    for(const item of layer.querySelectorAll('[data-network-part]'))item.remove();
    const svg=U.Painter.svg,network=scene.routeNetwork;
    const byEdge=new Map(scene.edges.map(edge=>[edge.id,edge]));
    const families=new Map(),tabbed=new Set(),labelBoxes=[];

    function members(ids){return ids.map(id=>byEdge.get(id)).filter(Boolean);}
    function count(ids){return new Set(members(ids).flatMap(edge=>(edge.originals||[edge]).map(value=>value.id))).size;}
    function inspect(ids,cable=false){
      const edges=members(ids);if(!edges.length)return;
      actions.inspect({...edges[0],...(cable?{kind:'namespace cable'}:{}),memberIds:ids,originals:edges.flatMap(edge=>edge.originals||[edge])});
    }
    function wrapper(item,interactive=true){
      const context=item.context??members(item.memberIds).every(edge=>edge.context);
      const group=svg(document,'g',{class:'edge-group'+(context?' is-context':''),'data-network-part':'true'});
      group.dataset.edgeIds=JSON.stringify(item.memberIds);
      if(item.color)group.setAttribute('style','--cable-color:'+safeColor(item.color));
      if(interactive){
        const name=item.accessibleName||(item.memberIds.length>1?'Shared '+item.kind+' path · '+item.memberIds.length+' connections':item.kind+': '+(byEdge.get(item.memberIds[0])?.label||item.memberIds[0]));
        group.setAttribute('role','button');
        group.setAttribute('tabindex',!tabbed.has(item.familyId)||item.memberIds.length>1?0:-1);
        tabbed.add(item.familyId);group.setAttribute('aria-label',name);
        const title=svg(document,'title');title.textContent=name;group.append(title);
        group.addEventListener('click',event=>{event.stopPropagation();inspect(item.memberIds,!!item.cable);});
        group.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();inspect(item.memberIds,!!item.cable);}});
      }
      return group;
    }

    function cableBadge(cable){
      const total=count(cable.memberIds),label=total+' '+(total===1?'link':'links'),width=label.length*6+20,height=23;
      const sections=cable.points.slice(1).map((b,i)=>({a:cable.points[i],b,length:Math.hypot(b.x-cable.points[i].x,b.y-cable.points[i].y)})).sort((a,b)=>b.length-a.length);
      const obstacles=[...scene.nodes,...scene.groups.map(group=>({x:group.x,y:group.y,width:group.width,height:group.headerBand||48})),...labelBoxes];
      const overlaps=(a,b)=>a.x<b.x+b.width+5&&a.x+a.width+5>b.x&&a.y<b.y+b.height+5&&a.y+a.height+5>b.y;
      for(const section of sections){
        if(section.length<width+18)continue;
        for(const fraction of [.5,.35,.65]){
          const box={x:section.a.x+(section.b.x-section.a.x)*fraction-width/2,y:section.a.y+(section.b.y-section.a.y)*fraction-height/2,width,height};
          if(box.x<8||box.y<8||box.x+width>scene.width-8||box.y+height>scene.height-8||obstacles.some(other=>overlaps(box,other)))continue;
          labelBoxes.push(box);return {box,label};
        }
      }
      return null;
    }

    // A cable represents a collection, so its spine intentionally has no UML marker.
    // Rounded corners soften direction changes without changing the underlying route.
    for(const cable of network.cables||[]){
      if(cable.points.length<2)continue;
      const item={...cable,kind:'namespace cable',familyId:cable.id,cable:true,accessibleName:'Namespace cable: '+cable.sourceName+' to '+cable.targetName+' · '+count(cable.memberIds)+' connections'};
      const group=wrapper(item);group.classList.add('namespace-cable');group.dataset.cableId=cable.id;
      const path=roundedPath(cable.points,10);
      const xs=cable.points.map(point=>point.x),ys=cable.points.map(point=>point.y);
      group.append(svg(document,'rect',{x:Math.min(...xs)-8,y:Math.min(...ys)-8,width:Math.max(...xs)-Math.min(...xs)+16,height:Math.max(...ys)-Math.min(...ys)+16,fill:'transparent','pointer-events':'none'}));
      group.append(svg(document,'path',{d:path,class:'namespace-cable-halo'}),svg(document,'path',{d:path,class:'namespace-cable-line'}),svg(document,'path',{d:path,class:'namespace-cable-hit'}));
      const badge=cableBadge(cable);
      if(badge){group.append(svg(document,'rect',{...badge.box,rx:11.5,class:'namespace-cable-badge'}));const text=svg(document,'text',{x:badge.box.x+badge.box.width/2,y:badge.box.y+15,'text-anchor':'middle',class:'namespace-cable-count'});text.textContent=badge.label;group.append(text);}
      layer.append(group);
    }

    // Halos precede strokes within each family so intended joins stay connected.
    // Later families show an explicit non-joining gap where they cross an earlier one.
    for(const segment of network.segments){
      if(!families.has(segment.familyId)){
        const family=svg(document,'g',{'data-network-part':'true'}),halos=svg(document,'g'),lines=svg(document,'g');
        family.append(halos,lines);layer.append(family);families.set(segment.familyId,{halos,lines});
      }
      const family=families.get(segment.familyId),halo=wrapper(segment,false),line=wrapper(segment),path=pathData(segment.points),[a,b]=segment.points;
      halo.append(svg(document,'path',{d:path,class:'edge-halo'}));
      line.append(svg(document,'rect',{x:Math.min(a.x,b.x)-6,y:Math.min(a.y,b.y)-6,width:Math.abs(a.x-b.x)+12,height:Math.abs(a.y-b.y)+12,fill:'transparent','pointer-events':'none'}),svg(document,'path',{d:path,class:'edge-line kind-'+segment.kind+(segment.color?' cable-branch-line':'')}),svg(document,'path',{d:path,class:'edge-hit'}));
      family.halos.append(halo);family.lines.append(line);
    }

    for(const terminal of network.markers){
      const group=wrapper(terminal,false),attributes={d:pathData(terminal.points),class:'edge-terminal kind-'+terminal.kind};
      attributes[terminal.start?'marker-start':'marker-end']='url(#uml-'+terminal.marker+')';
      group.append(svg(document,'path',attributes));layer.append(group);
    }
    for(const edge of scene.edges){
      const annotation=wrapper({memberIds:[edge.id],context:edge.context,kind:edge.kind,familyId:edge.familyId},false),box=edge.labelBox;
      if(box){
        annotation.append(svg(document,'rect',{x:box.x,y:box.y,width:box.width,height:box.height,rx:5,class:'edge-label-background'}));
        const text=svg(document,'text',{x:box.x+8,y:box.y+17,class:'edge-label'});
        edge.labelLines.forEach((line,i)=>{const span=svg(document,'tspan',{x:box.x+8,dy:i?17:0});span.textContent=line;text.append(span);});annotation.append(text);
      }
      for(const [value,at] of [[edge.cableCollapsedSource?null:edge.fromMultiplicity,edge.points[0]],[edge.unrouted||edge.cableCollapsedTarget?null:edge.toMultiplicity,edge.points.at(-1)]])if(value){const text=svg(document,'text',{x:at.x+9,y:at.y-10,class:'multiplicity'});text.textContent=value;annotation.append(text);}
      if(edge.routingWarning){const at=edge.points[0],text=svg(document,'text',{x:at.x+10,y:at.y+16,class:'route-warning'});text.textContent='!';annotation.append(text);}
      layer.append(annotation);
    }
    for(const badge of network.badges){
      const group=wrapper(badge,true),box=badge.box;group.setAttribute('tabindex','0');
      group.append(svg(document,'rect',{...box,rx:9,class:'bundle-badge'}));
      const text=svg(document,'text',{x:box.x+box.width/2,y:box.y+12,'text-anchor':'middle',class:'bundle-count'});text.textContent=badge.memberIds.length;group.append(text);layer.append(group);
    }

    // Boundary sockets are drawn last so local fan-out meets an unmistakable terminal.
    for(const gate of network.gates||[]){
      const outgoing=gate.flow==='out',name=(outgoing?'Out of ':'Into ')+gate.groupName+' · '+count(gate.memberIds)+' connections';
      const group=wrapper({...gate,kind:'namespace cable',familyId:gate.cableId,cable:true,accessibleName:name});
      group.classList.add('namespace-gateway');group.dataset.cableId=gate.cableId;group.dataset.gatewayId=gate.id;group.setAttribute('tabindex','0');
      if(gate.bankId)group.dataset.bankId=gate.bankId;
      const point=gate.point,label=outgoing?'OUT':'IN',width=outgoing?35:28,height=18;
      const left=gate.side==='left',top=gate.side==='top',bottom=gate.side==='bottom';
      const x=Math.max(8,Math.min(scene.width-width-8,left?point.x-width-12:point.x+12));
      const y=Math.max(8,Math.min(scene.height-height-8,top?point.y-29:bottom?point.y+11:point.y-25));
      group.append(svg(document,'circle',{cx:point.x,cy:point.y,r:8,class:'namespace-gateway-hit'}),svg(document,'circle',{cx:point.x,cy:point.y,r:5.5,class:'namespace-gateway-socket'}),svg(document,'circle',{cx:point.x,cy:point.y,r:2,class:'namespace-gateway-core'}));
      if(gate.bankIndex===undefined||gate.bankIndex===0){
        group.append(svg(document,'rect',{x,y,width,height,rx:5,class:'namespace-gateway-label-background'}));
        const text=svg(document,'text',{x:x+width/2,y:y+12,'text-anchor':'middle',class:'namespace-gateway-label'});text.textContent=label;group.append(text);
      }
      layer.append(group);
    }
  }
  U.ConnectionPainter={draw,roundedPath};
})(globalThis);
