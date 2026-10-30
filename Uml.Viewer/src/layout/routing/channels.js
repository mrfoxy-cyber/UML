(function(root){
  'use strict';const U=root.UmlViewer ||= {},eps=.1;
  const same=(a,b)=>Math.abs(a-b)<eps;
  const horizontal=(a,b)=>same(a.y,b.y);
  function hits(a,b,r){if(horizontal(a,b))return a.y>r.y+eps&&a.y<r.y+r.height-eps&&Math.max(a.x,b.x)>r.x+eps&&Math.min(a.x,b.x)<r.x+r.width-eps;if(same(a.x,b.x))return a.x>r.x+eps&&a.x<r.x+r.width-eps&&Math.max(a.y,b.y)>r.y+eps&&Math.min(a.y,b.y)<r.y+r.height-eps;return true;}
  function overlap(a,b,c,d){if(horizontal(a,b)!==horizontal(c,d))return 0;if(horizontal(a,b)){if(!same(a.y,c.y))return 0;return Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x));}if(!same(a.x,c.x))return 0;return Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y));}
  function crosses(a,b,c,d){if(horizontal(a,b)===horizontal(c,d))return false;const h=horizontal(a,b)?[a,b]:[c,d],v=horizontal(a,b)?[c,d]:[a,b];return v[0].x>Math.min(h[0].x,h[1].x)+eps&&v[0].x<Math.max(h[0].x,h[1].x)-eps&&h[0].y>Math.min(v[0].y,v[1].y)+eps&&h[0].y<Math.max(v[0].y,v[1].y)-eps;}
  class Heap{constructor(){this.a=[];}push(v){const a=this.a;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].score<=v.score)break;a[i]=a[p];i=p;}a[i]=v;}pop(){const a=this.a,v=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].score<a[c].score)c++;if(a[c].score>=last.score)break;a[i]=a[c];i=c;}a[i]=last;}return v;}}
  function boxes(scene,edge){const allowed=new Set([scene.nodes.find(n=>n.id===edge.source)?.groupId,scene.nodes.find(n=>n.id===edge.target)?.groupId]);return [...scene.nodes.map(n=>({x:n.x-8,y:n.y-8,width:n.width+16,height:n.height+16})),...scene.groups.map(g=>allowed.has(g.id)?{x:g.x,y:g.y,width:g.width,height:g.headerBand||48}:{x:g.x-10,y:g.y-10,width:g.width+20,height:g.height+20})];}
  function create(scene){
    const occupied=[];
    function reserve(points,family){for(let i=1;i<points.length;i++)if(!same(points[i].x,points[i-1].x)||!same(points[i].y,points[i-1].y))occupied.push({a:points[i-1],b:points[i],family});}
    function path(start,end,obstacles,family,{fast=false,bounds=null,relaxed=false}={}){
      const within=p=>p.x>=8&&p.y>=8&&(!bounds||(p.x>=bounds.x&&p.y>=bounds.y&&p.x<=bounds.x+bounds.width&&p.y<=bounds.y+bounds.height));
      function cost(a,b){if(!within(a)||!within(b)||obstacles.some(r=>hits(a,b,r)))return Infinity;let score=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
        for(const o of occupied)if(o.family!==family){if(overlap(a,b,o.a,o.b)>eps){if(!relaxed)return Infinity;score+=150;}else if(!relaxed&&crosses(a,b,o.a,o.b))score+=110;}
        return score;
      }
      const clean=U.RouteSimplifier.clean,candidates=[[start,end],[start,{x:start.x,y:end.y},end],[start,{x:end.x,y:start.y},end]];
      for(const x of [(start.x+end.x)/2,Math.max(12,Math.min(start.x,end.x)-38),Math.max(start.x,end.x)+38])candidates.push([start,{x,y:start.y},{x,y:end.y},end]);
      for(const y of [(start.y+end.y)/2,Math.max(12,Math.min(start.y,end.y)-38),Math.max(start.y,end.y)+38])candidates.push([start,{x:start.x,y},{x:end.x,y},end]);
      const ranked=candidates.map(clean).map(points=>({points,cost:points.slice(1).reduce((s,p,i)=>s+cost(points[i],p)+(i?32:0),0)})).filter(v=>Number.isFinite(v.cost)).sort((a,b)=>a.cost-b.cost);
      const direct=ranked[0];if(fast||direct)return direct?.points||null;
      const xs=[...new Set([start.x,end.x,12,...obstacles.flatMap(r=>[Math.max(12,r.x-12),r.x+r.width+12]),...(relaxed?[]:occupied.flatMap(o=>horizontal(o.a,o.b)?[]:[o.a.x-14,o.a.x+14]))])].filter(x=>x>=8).sort((a,b)=>a-b);
      const ys=[...new Set([start.y,end.y,12,...obstacles.flatMap(r=>[Math.max(12,r.y-12),r.y+r.height+12]),...(relaxed?[]:occupied.flatMap(o=>horizontal(o.a,o.b)?[o.a.y-14,o.a.y+14]:[]))])].filter(y=>y>=8).sort((a,b)=>a-b);
      const queue=new Heap(),best=new Map(),tx=xs.indexOf(end.x),ty=ys.indexOf(end.y);queue.push({x:xs.indexOf(start.x),y:ys.indexOf(start.y),dir:0,cost:0,score:0,previous:null});let budget=24000;
      while(queue.a.length&&budget--){const current=queue.pop(),key=current.x+','+current.y+','+current.dir;if(best.has(key)&&best.get(key)<current.cost)continue;
        if(current.x===tx&&current.y===ty){const points=[];for(let p=current;p;p=p.previous)points.push({x:xs[p.x],y:ys[p.y]});return clean(points.reverse());}
        for(const [dx,dy,dir] of [[1,0,1],[-1,0,1],[0,1,2],[0,-1,2]]){const x=current.x+dx,y=current.y+dy;if(x<0||y<0||x>=xs.length||y>=ys.length)continue;
          const a={x:xs[current.x],y:ys[current.y]},b={x:xs[x],y:ys[y]},nextCost=current.cost+cost(a,b)+(current.dir&&current.dir!==dir?32:0);if(!Number.isFinite(nextCost)||direct&&nextCost>=direct.cost)continue;
          const key=x+','+y+','+dir;if(best.has(key)&&best.get(key)<=nextCost)continue;best.set(key,nextCost);queue.push({x,y,dir,cost:nextCost,score:nextCost+Math.abs(b.x-end.x)+Math.abs(b.y-end.y),previous:current});
        }
      }
      return direct?.points||null;
    }
    return {path,reserve,occupied};
  }
  U.ConnectionChannels={create,boxes,hits,overlap,crosses};
})(globalThis);
