(function(root){
  'use strict';const U=root.UmlViewer ||= {};
  function place(scene){
    const occupied=[...scene.nodes,...scene.groups.map(g=>({x:g.x,y:g.y,width:g.width,height:g.headerBand||48}))],intersects=(a,b)=>a.x<b.x+b.width+4&&a.x+a.width+4>b.x&&a.y<b.y+b.height+4&&a.y+a.height+4>b.y;
    for(const edge of scene.edges){edge.labelLines=edge.label?U.Measure.wrap(edge.label,190,text=>text.length*6.4,12):[];edge.labelBox=null;if(!edge.label)continue;
      const width=Math.min(220,Math.max(...edge.labelLines.map(t=>t.length))*6.4+18),height=edge.labelLines.length*17+10;
      const paths=edge.branchPaths||[edge.points],segments=paths.flatMap(points=>points.slice(1).map((b,i)=>({a:points[i],b,length:Math.abs(b.x-points[i].x)+Math.abs(b.y-points[i].y)}))).sort((a,b)=>b.length-a.length);
      outer:for(const {a,b} of segments)for(const sign of [-1,1]){const horizontal=Math.abs(a.y-b.y)<.1,box={x:(a.x+b.x)/2+(horizontal?-width/2:sign<0?-width-9:9),y:(a.y+b.y)/2+(horizontal?sign<0?-height-9:9:-height/2),width,height};if(!occupied.some(r=>intersects(box,r))){edge.labelBox=box;occupied.push(box);break outer;}}
      // If all positions are crowded, keep the label available in the inspector instead of covering a card.
    }
  }
  U.ConnectionLabels={place};
})(globalThis);
