(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  function createMeasurer(document){let context;try{context=document?.createElement('canvas').getContext('2d');}catch{}
    return function(text,size=13,weight=400){if(context){context.font=`${weight} ${size}px "Segoe UI", Arial, sans-serif`;return context.measureText(String(text)).width;}return [...String(text)].length*size*.55;};
  }
  function wrap(text,width,measure,size=13,weight=400){
    const lines=[];for(const paragraph of String(text).split('\n')){
      let line='';for(const word of paragraph.split(/\s+/)){
        if(measure((line?line+' ':'')+word,size,weight)<=width)line+=(line?' ':'')+word;
        else {if(line)lines.push(line);line='';for(const char of word){if(line&&measure(line+char,size,weight)>width){lines.push(line);line='';}line+=char;}}
      }lines.push(line);
    }return lines;
  }
  function node(node,context){
    const {presentation:p,item}=node,measure=context.measure;
    const width=p.open?350:node.preferredWidth||(node.kind==='actor'?184:node.kind==='component'?280:224);
    const titleLines=wrap(p.name,width-(node.kind==='actor'?104:node.kind==='component'?100:64),measure,14,600);
    const rows=[];
    if(p.show.has('count')){
      const n=node.count??item.members?.length??0;if(n)rows.push({text:n+(node.kind==='collapsed-group'?' elements':node.messages?' outgoing messages':' members'),muted:true});
    }
    if(p.show.has('members'))for(const value of node.messages||item.members||[])rows.push({text:typeof value==='string'?value:JSON.stringify(value)});
    if(p.show.has('notes')&&item.notes)rows.push({text:item.notes,muted:true});
    const headerHeight=Math.max(node.kind==='actor'?92:64,28+titleLines.length*19+(p.show.has('kind')?18:0));
    let bodyHeight=rows.reduce((sum,row)=>sum+Math.max(1,wrap(row.text,width-36,measure,12).length)*18+10,0);
    bodyHeight=Math.min(p.open?280:64,bodyHeight);
    return {...node,width,height:headerHeight+(rows.length?bodyHeight+24:0),headerHeight,titleLines,rows};
  }
  U.Measure={createMeasurer,wrap,node};
  if(typeof module==='object'&&module.exports)module.exports=U.Measure;
})(globalThis);
