(function(root){
  'use strict';const U=root.UmlViewer ||= {},near=(a,b)=>Math.abs(a-b)<.1;
  function hits(a,b,r){
    if(near(a.x,b.x))return a.x>r.x+.1&&a.x<r.x+r.width-.1&&Math.max(a.y,b.y)>r.y+.1&&Math.min(a.y,b.y)<r.y+r.height-.1;
    if(near(a.y,b.y))return a.y>r.y+.1&&a.y<r.y+r.height-.1&&Math.max(a.x,b.x)>r.x+.1&&Math.min(a.x,b.x)<r.x+r.width-.1;
    return true;
  }
  const length=points=>points.slice(1).reduce((n,p,i)=>n+Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y),0);
  function ports(a,b,edge){
    const ac={x:a.x+a.width/2,y:a.y+a.height/2},bc={x:b.x+b.width/2,y:b.y+b.height/2};
    const vertical=['inheritance','implementation'].includes(edge.kind)?Math.abs(ac.y-bc.y)>30:Math.abs(ac.y-bc.y)>Math.abs(ac.x-bc.x);
    const dir=vertical?(bc.y>=ac.y?1:-1):(bc.x>=ac.x?1:-1);
    const start=vertical?{x:ac.x,y:ac.y+dir*a.height/2}:{x:ac.x+dir*a.width/2,y:ac.y};
    const end=vertical?{x:bc.x,y:bc.y-dir*b.height/2}:{x:bc.x-dir*b.width/2,y:bc.y};
    const s={x:start.x+(vertical?0:dir*14),y:start.y+(vertical?dir*14:0)},t={x:end.x-(vertical?0:dir*14),y:end.y-(vertical?dir*14:0)};
    return {start,end,s,t};
  }
  class Heap{
    constructor(){this.items=[];}
    push(value){const a=this.items;a.push(value);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].score<=value.score)break;a[i]=a[p];i=p;}a[i]=value;}
    pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].score<a[c].score)c++;if(a[c].score>=last.score)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
  }
  function search(start,end,boxes){
    const xs=[...new Set([start.x,end.x,12,...boxes.flatMap(r=>[Math.max(8,r.x-5),r.x+r.width+5])])].sort((a,b)=>a-b);
    const ys=[...new Set([start.y,end.y,12,...boxes.flatMap(r=>[Math.max(8,r.y-5),r.y+r.height+5])])].sort((a,b)=>a-b);
    const tx=xs.indexOf(end.x),ty=ys.indexOf(end.y),queue=new Heap(),best=new Map();
    const first={x:xs.indexOf(start.x),y:ys.indexOf(start.y),dir:0,cost:0,previous:null};first.score=0;queue.push(first);
    let budget=5000;
    while(queue.items.length&&budget--){
      const current=queue.pop(),key=current.x+','+current.y+','+current.dir;
      if(best.has(key)&&best.get(key)<current.cost)continue;
      if(current.x===tx&&current.y===ty){const result=[];for(let p=current;p;p=p.previous)result.push({x:xs[p.x],y:ys[p.y]});return result.reverse();}
      for(const [dx,dy,dir] of [[-1,0,1],[1,0,1],[0,-1,2],[0,1,2]]){
        const x=current.x+dx,y=current.y+dy;if(x<0||y<0||x>=xs.length||y>=ys.length)continue;
        const a={x:xs[current.x],y:ys[current.y]},b={x:xs[x],y:ys[y]};if(boxes.some(box=>hits(a,b,box)))continue;
        const cost=current.cost+Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+(current.dir&&current.dir!==dir?42:0),nextKey=x+','+y+','+dir;
        if(best.has(nextKey)&&best.get(nextKey)<=cost)continue;best.set(nextKey,cost);
        queue.push({x,y,dir,cost,score:cost+Math.abs(b.x-end.x)+Math.abs(b.y-end.y),previous:current});
      }
    }
    return null;
  }
  function route(edge,nodes,fast=false){
    const a=nodes.find(n=>n.id===edge.source),b=nodes.find(n=>n.id===edge.target);if(!a||!b)return edge;
    if(a.id===b.id){const x=a.x+a.width,y=a.y+a.height/2;return {...edge,points:[{x,y},{x:x+35,y},{x:x+35,y:a.y-24},{x:a.x+a.width/2,y:a.y-24},{x:a.x+a.width/2,y:a.y}],routingWarning:false};}
    const {start,end,s,t}=ports(a,b,edge),boxes=nodes.map(n=>({x:n.x-7,y:n.y-7,width:n.width+14,height:n.height+14}));
    const clean=U.RouteSimplifier.clean,clear=points=>points.slice(1).every((p,i)=>!boxes.some(box=>hits(points[i],p,box)));
    const candidates=[[s,t],[s,{x:s.x,y:t.y},t],[s,{x:t.x,y:s.y},t]].map(clean).filter(points=>clear(points));
    let middle=candidates.sort((a,b)=>(a.length-b.length)||length(a)-length(b))[0];
    if(!middle&&!fast)middle=search(s,t,boxes);
    const warning=!middle;middle ||= [s,{x:s.x,y:t.y},t];
    const points=clean([start,...middle,end]);let labelBox=edge.labelBox;
    if(edge.label){
      const segment=points.slice(1).map((p,i)=>({a:points[i],b:p,length:Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y)})).sort((a,b)=>b.length-a.length)[0];
      const width=labelBox?.width||180,height=labelBox?.height||28;
      labelBox={x:(segment.a.x+segment.b.x-width)/2,y:(segment.a.y+segment.b.y)/2-height-6,width,height};
    }
    return {...edge,points,labelBox,routingWarning:warning&&!fast};
  }
  function scene(scene,{fast=false}={}){if(scene.coordinated&&U.ConnectionRouter)return U.ConnectionRouter.scene(scene,{fast});scene.edges=scene.edges.map(edge=>route(edge,scene.nodes,fast));return scene;}
  U.EdgeRouter={route,scene};if(typeof module==='object'&&module.exports)module.exports=U.EdgeRouter;
})(globalThis);
