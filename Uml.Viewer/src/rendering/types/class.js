(function(root){
  'use strict';const U=root.UmlViewer;
  function interfaceShortcuts(data,document){
    const nodes=new Map(data.nodes.map(node=>[node.id,node])),links=[];
    for(const edge of data.edges){
      if(edge.kind!=='implementation'||edge.proxy||nodes.get(edge.target)?.kind!=='interface')continue;
      const owner=nodes.get(edge.source),contract=nodes.get(edge.target);if(!owner)continue;
      owner.shortcutLinks ||= [];contract.shortcutLinks ||= [];
      if(!owner.shortcutLinks.some(link=>link.targetId===edge.target))owner.shortcutLinks.push({targetId:edge.target,name:document.elements[edge.to].name,direction:'implements',context:edge.context});
      if(!contract.shortcutLinks.some(link=>link.targetId===edge.source))contract.shortcutLinks.push({targetId:edge.source,name:document.elements[edge.from].name,direction:'implemented-by',context:edge.context});
      links.push(edge);
    }
    for(const node of data.nodes)node.shortcutLinks?.sort((a,b)=>a.name.localeCompare(b.name)||a.targetId.localeCompare(b.targetId));
    const ids=new Set(links.map(link=>link.id));data.edges=data.edges.filter(edge=>!ids.has(edge.id));
    return links;
  }
  function addInterfaceShelf(scene,interfaces,context){
    if(!interfaces.length)return scene;
    const cards=interfaces.map(node=>U.Measure.node(node,context)),width=Math.max(...cards.map(node=>node.width)),height=Math.max(...cards.map(node=>node.height));
    const columns=Math.max(1,Math.min(6,cards.length,Math.floor((scene.width-40)/(width+32)))),rows=Math.ceil(cards.length/columns);
    const offset=64+rows*(height+30);
    for(const node of scene.nodes)node.y+=offset;
    for(const group of scene.groups)group.y+=offset;
    for(const edge of scene.edges){for(const point of edge.points)point.y+=offset;if(edge.labelBox)edge.labelBox.y+=offset;}
    scene.nodes.push(...cards.map((node,i)=>({...node,x:36+(i%columns)*(width+32),y:52+Math.floor(i/columns)*(height+30)})));
    scene.labels.push({x:36,y:12,width:scene.width,lines:['Interfaces · use the shortcuts to jump between contracts and classes'],section:true});
    scene.width=Math.max(scene.width,72+columns*(width+32));scene.height+=offset;
    return scene;
  }
  U.Renderers.register('class',{async build(document,view,context){
    const data=U.Model.structural(document,view,context.state);
    const connections=data.edges.slice(),shortcuts=context.state.interfacesAsLines?[]:interfaceShortcuts(data,document);
    const grouped=context.state.groupLayout!==false;
    let shelf=[];
    if(!grouped){
      const groups=new Map(data.groups.map(group=>[group.id,group]));
      data.nodes=data.nodes.map(node=>({...node,namespace:groups.get(node.groupId)?.item.name,groupId:null}));data.groups=[];
      const connected=new Set(data.edges.flatMap(edge=>[edge.source,edge.target]));
      shelf=data.nodes.filter(node=>node.kind==='interface'&&!connected.has(node.id)&&node.shortcutLinks?.length);
      const shelfIds=new Set(shelf.map(node=>node.id));data.nodes=data.nodes.filter(node=>!shelfIds.has(node.id));
    }
    const hierarchy=data.edges.some(edge=>['inheritance','implementation'].includes(edge.kind));
    const direction=hierarchy||context.viewport.width<context.viewport.height?'DOWN':'RIGHT';
    const scene=addInterfaceShelf(await U.GraphLayout(data,context,{direction,inheritanceUp:true,nodeGap:52,layerGap:86,simplify:true}),shelf,context);
    return {...scene,connections,interfaceLinks:shortcuts,caption:'Select a class to focus its immediate connections. Interface shortcuts jump to the contract; reciprocal shortcuts return to implementing classes. Full interface lines and group frames are available above.',legend:[['inheritance','Inherits'],['implementation',shortcuts.length?'Interface shortcut (navigation)':'Implements'],['dependency','Depends on'],['association','Association']]};
  }});
})(globalThis);
