(function(root){
  'use strict';const U=root.UmlViewer;
  U.Renderers.register('sequence',{async build(document,view,context){
    const interaction=U.Model.interaction(document,view.interaction),state=context.state;
    const headers=interaction.participants.map(id=>U.Measure.node({id,sourceId:id,item:document.elements[id],kind:document.elements[id].kind,preferredWidth:document.elements[id].kind==='actor'?184:200,presentation:U.Model.presentation(document.elements[id],id,state)},context));
    let x=48;const columns=new Map();
    for(const node of headers){node.x=x;node.y=36;columns.set(node.id,x+node.width/2);x+=node.width+52;}
    const width=Math.max(650,x-28),headerBottom=Math.max(...headers.map(n=>n.y+n.height));
    const nodes=[...headers],edges=[],groups=[],labels=[],byId=new Map(interaction.messages.map(m=>[m.id,m]));
    let y=headerBottom+40;
    function rows(steps,depth=0){
      for(const step of steps){
        if(step.kind==='alt'){
          const key='fragment:'+view.interaction+':'+step.id,p=U.Model.presentation(step,key,state,'fragment');
          const top=y,left=20+depth*16,w=width-2*left;
          const frame={id:key,sourceId:step.id,key,item:step,presentation:p,count:step.branches.length,x:left,y:top,width:w,height:58,fragment:true};
          y+=64;
          if(p.open&&p.show.has('steps')){
            step.branches.forEach((branch,i)=>{
              const lines=U.Measure.wrap('['+branch.guard+']',w-48,context.measure,12,500);
              labels.push({id:key+':guard:'+i,x:left+20,y:y+4,lines,guard:true,separator:i>0,width:w-40});
              y+=lines.length*17+26;rows(branch.steps,depth+1);y+=18;
            });
          }else if(p.show.has('guards')){
            for(const branch of step.branches){const lines=U.Measure.wrap('['+branch.guard+']',w-48,context.measure,12);labels.push({x:left+20,y:y+4,lines,guard:true});y+=lines.length*17+12;}
          }
          frame.height=y-top+6;groups.push(frame);y+=26;
          continue;
        }
        const message=byId.get(step.id),from=columns.get(step.from),to=columns.get(step.to),self=from===to;
        const maxWidth=Math.max(180,Math.min(420,Math.abs(to-from)-30||300));
        const labelLines=U.Measure.wrap(message.number+'  '+step.label,maxWidth,context.measure,13);
        const labelWidth=Math.min(maxWidth+16,Math.max(...labelLines.map(line=>context.measure(line,13)))+16);
        const arrowY=y+labelLines.length*18+14;
        const points=self?[{x:from,y:arrowY},{x:from+66,y:arrowY},{x:from+66,y:arrowY+30},{x:from,y:arrowY+30}]:[{x:from,y:arrowY},{x:to,y:arrowY}];
        const labelX=self?Math.min(width-labelWidth-30,from+14):Math.min(width-labelWidth-26,Math.max(24,(from+to-labelWidth)/2));
        edges.push({id:'message:'+step.id,source:step.from,target:step.to,kind:step.kind,label:step.label,labelLines,labelBox:{x:labelX,y:y-2,width:labelWidth,height:labelLines.length*18+12},points,message,messages:[message]});
        y=arrowY+(self?60:34);
      }
    }
    rows(interaction.steps);
    const height=y+32;
    return {width,height,nodes,edges,groups,labels,interaction,lifelines:headers.map(n=>({x:columns.get(n.id),y:n.y+n.height,bottom:height-28})),caption:'Read from top to bottom. Calls and replies retain their shared message IDs. Open an alternative frame to see its guarded paths.',legend:[['call','Call'],['reply','Reply'],['alt','Alternative paths']]};
  }});
})(globalThis);
