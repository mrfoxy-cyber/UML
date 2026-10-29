(function(root){
  'use strict';const U=root.UmlViewer ||= {},epsilon=.05;
  const same=(a,b)=>Math.abs(a-b)<epsilon;
  function clean(points){
    const result=[];
    for(const point of points){
      if(result.length&&same(point.x,result.at(-1).x)&&same(point.y,result.at(-1).y))continue;
      result.push(point);
      while(result.length>2){const [a,b,c]=result.slice(-3);if((same(a.x,b.x)&&same(b.x,c.x))||(same(a.y,b.y)&&same(b.y,c.y)))result.splice(-2,1);else break;}
    }
    return result;
  }
  function hits(a,b,box){
    if(same(a.x,b.x))return a.x>box.x+epsilon&&a.x<box.x+box.width-epsilon&&Math.max(a.y,b.y)>box.y+epsilon&&Math.min(a.y,b.y)<box.y+box.height-epsilon;
    if(same(a.y,b.y))return a.y>box.y+epsilon&&a.y<box.y+box.height-epsilon&&Math.max(a.x,b.x)>box.x+epsilon&&Math.min(a.x,b.x)<box.x+box.width-epsilon;
    return true;
  }
  function simplify(points,nodes,source,target,groups=[]){
    let route=clean(points);if(source===target||route.length<3)return route;
    const boxes=nodes.map(node=>{const margin=[source,target].includes(node.id)?0:7;return {x:node.x-margin,y:node.y-margin,width:node.width+margin*2,height:node.height+margin*2};});
    for(const group of groups)boxes.push({x:group.x,y:group.y,width:group.width,height:48+(group.noteHeight||0)});
    const clear=candidate=>candidate.slice(1).every((point,i)=>!boxes.some(box=>hits(candidate[i],point,box)));
    let attempts=0;
    for(let i=0;i<route.length-2&&attempts<120;i++){
      for(let j=route.length-1;j>i+1&&attempts++<120;j--){
        const a=route[i],b=route[j],candidates=[];
        if(same(a.x,b.x)||same(a.y,b.y))candidates.push([a,b]);
        candidates.push([a,{x:a.x,y:b.y},b],[a,{x:b.x,y:a.y},b]);
        const replacement=candidates.map(clean).find(candidate=>candidate.length<j-i+1&&clear(candidate));
        if(replacement){route=clean([...route.slice(0,i),...replacement,...route.slice(j+1)]);i=Math.max(-1,i-1);break;}
      }
    }
    return route;
  }
  U.RouteSimplifier={clean,simplify};
  if(typeof module==='object'&&module.exports)module.exports=U.RouteSimplifier;
})(globalThis);
