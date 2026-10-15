// ALGO/ART V5g: genuinely connected, filled, material-neutral colour areas.
// Experimental, isolated: frozen V5e/f and Faithful remain unchanged.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5fTest||!A.planCompositionV5FromSource)
  throw Error('V5g needs frozen V5f source planner');
var frozen=A.planCompositionV5FromSource,VERSION='v5g-connected-colour-areas-1';
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function pt(x,y){return{x:+x.toFixed(2),y:+y.toFixed(2)}}
function inside(p,poly){
  var result=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    var a=poly[i],b=poly[j];
    if((a.y>p.y)!==(b.y>p.y)&&
      p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
  }
  return result;
}
function rectInside(x,y,v){
  return x>=v.x&&x<=v.x+v.w&&y>=v.y&&y<=v.y+v.h;
}
function polygonArea(p){
  var a=0;for(var i=0;i<p.length;i++){
    var b=p[(i+1)%p.length];a+=p[i].x*b.y-b.x*p[i].y;
  }
  return Math.abs(a)*.5;
}
function bbox(p){
  var xs=p.map(x=>x.x),ys=p.map(x=>x.y),
      l=Math.min.apply(null,xs),r=Math.max.apply(null,xs),
      t=Math.min.apply(null,ys),b=Math.max.apply(null,ys);
  return{x:l,y:t,w:r-l,h:b-t};
}
// The unit test and flat preview can read the very same occupancy data.
// Each true grid cell represents filled INTERIOR, never a path width.
function deriveMask(fields,plan,cell){
  cell=cell||12;
  var nx=Math.ceil(plan.width/cell),ny=Math.ceil(plan.height/cell),
      mask=new Uint8Array(nx*ny),original=new Uint8Array(nx*ny),
      voids=plan.protectedVoids||[];
  function reserved(x,y){return voids.some(v=>rectInside(x,y,v))}
  for(var y=0;y<ny;y++)for(var x=0;x<nx;x++){
    var px=(x+.5)*cell,py=(y+.5)*cell,index=y*nx+x;
    if(px<8||py<8||px>plan.width-8||py>plan.height-8||reserved(px,py))
      continue;
    for(var i=0;i<fields.length;i++){
      var f=fields[i],bb=f.box;
      if(px<bb.x-25||px>bb.x+bb.w+25||
         py<bb.y-25||py>bb.y+bb.h+25)continue;
      // Spatial warping deliberately breaks large convex/cut-paper outlines,
      // without changing the source-derived area or inventing disconnected dabs.
      var dx=Math.sin(py*.020+f.seed%31)*11+
        Math.cos(px*.034+f.seed%13)*5;
      var dy=Math.sin(px*.023+f.seed%23)*10+
        Math.cos(py*.031+f.seed%17)*5;
      if(inside({x:px+dx,y:py+dy},f.contour)){mask[index]=1;break}
    }
  }
  original.set(mask);
  // Morphological closing connects adjacent occupied source territories,
  // then fills narrow channels BETWEEN marks rather than widening every path.
  var grown=new Uint8Array(mask.length),closed=new Uint8Array(mask.length);
  for(y=0;y<ny;y++)for(x=0;x<nx;x++){
    var p=y*nx+x,hit=false;
    for(var dy=-1;dy<=1&&!hit;dy++)for(var dx=-1;dx<=1;dx++){
      var ax=x+dx,ay=y+dy;
      if(ax>=0&&ay>=0&&ax<nx&&ay<ny&&mask[ay*nx+ax]){hit=true;break}
    }
    grown[p]=hit?1:0;
  }
  for(y=0;y<ny;y++)for(x=0;x<nx;x++){
    var cx=(x+.5)*cell,cy=(y+.5)*cell,p=y*nx+x;
    if(reserved(cx,cy))continue;
    var all=true;
    for(dy=-1;dy<=1&&all;dy++)for(dx=-1;dx<=1;dx++){
      var ax=x+dx,ay=y+dy;
      if(ax<0||ay<0||ax>=nx||ay>=ny||!grown[ay*nx+ax]){
        all=false;break;
      }
    }
    // Preserve outermost original source occupancy at the canvas margins.
    closed[p]=all||original[p]?1:0;
  }
  return{mask:closed,nx:nx,ny:ny,cell:cell};
}
function components(g){
  var m=g.mask,nx=g.nx,ny=g.ny,seen=new Uint8Array(m.length),
      parts=[];
  for(var k=0;k<m.length;k++){
    if(!m[k]||seen[k])continue;
    var queue=[k],j=0;seen[k]=1;
    for(;j<queue.length;j++){
      var i=queue[j],x=i%nx,y=Math.floor(i/nx),
          nei=[x>0?i-1:-1,x<nx-1?i+1:-1,
            y>0?i-nx:-1,y<ny-1?i+nx:-1];
      for(var n=0;n<4;n++){
        var v=nei[n];if(v>=0&&m[v]&&!seen[v]){
          seen[v]=1;queue.push(v);
        }
      }
    }
    if(queue.length>=15)parts.push(queue);
  }
  return parts.sort((a,b)=>b.length-a.length);
}
// Extract the connected binary area's actual OUTER outline via oriented
// boundary edges. Holes are recorded separately and are clipped in material.
function contourOf(cells,g){
  var occupied=new Set(cells),nx=g.nx,step=g.cell,edges=new Map();
  function edge(x1,y1,x2,y2){
    var k=x1+','+y1,a=edges.get(k)||[];
    a.push([x2,y2]);edges.set(k,a);
  }
  for(var k=0;k<cells.length;k++){
    var index=cells[k],x=index%nx,y=Math.floor(index/nx);
    if(!occupied.has(index-nx)||y===0)edge(x,y,x+1,y);
    if(!occupied.has(index+1)||x===nx-1)edge(x+1,y,x+1,y+1);
    if(!occupied.has(index+nx))edge(x+1,y+1,x,y+1);
    if(!occupied.has(index-1)||x===0)edge(x,y+1,x,y);
  }
  var loops=[];
  while(edges.size){
    var first=edges.keys().next().value,k=first,coords=[],count=0;
    do{
      var a=edges.get(k);if(!a||!a.length)break;
      var xy=k.split(',').map(Number);
      coords.push(pt(xy[0]*step,xy[1]*step));
      var next=a.pop();if(!a.length)edges.delete(k);
      k=next[0]+','+next[1];
    }while(k!==first&&++count<5000);
    if(coords.length>=4)loops.push(coords);
  }
  if(!loops.length)return[];
  loops.sort((a,b)=>polygonArea(b)-polygonArea(a));
  var outer=loops[0],result=[];
  // Remove redundant collinear grid vertices: the outline remains connected
  // but no longer becomes a visible stepped/pixelated shape.
  for(var i=0;i<outer.length;i++){
    var pre=outer[(i+outer.length-1)%outer.length],
        a=outer[i],post=outer[(i+1)%outer.length];
    if((a.x-pre.x)*(post.y-a.y)===(a.y-pre.y)*(post.x-a.x))continue;
    result.push(a);
  }
  if(result.length<4)return outer;
  return result;
}
function colouredAreas(fields,plan){
  if(!fields.length)return[];
  var g=deriveMask(fields,plan,12),parts=components(g),
      areas=[];
  for(var i=0;i<parts.length;i++){
    var cells=parts[i],contour=contourOf(cells,g);
    if(contour.length<4)continue;
    var bb=bbox(contour),members=fields.filter(f=>{
      // Member fields are those with measurable occupancy of this component.
      var count=0;
      for(var j=0;j<cells.length;j+=Math.max(1,Math.floor(cells.length/80))){
        var index=cells[j],p={x:((index%g.nx)+.5)*g.cell,
          y:(Math.floor(index/g.nx)+.5)*g.cell};
        if(inside(p,f.contour))count++;
      }
      return count>0;
    });
    if(!members.length)members=[fields[0]];
    var unique=[],palette=[];
    members.forEach(f=>{
      (f.sources||[]).forEach(s=>{if(!unique.includes(s))unique.push(s)});
      (f.palette||[f.rgb]).forEach(c=>{
        if(!palette.some(v=>Math.hypot(...v.map((n,i)=>n-c[i]))<40))
          palette.push(c.slice());
      });
    });
    var area=cells.length*g.cell*g.cell;
    if(area<3600||!unique.length)continue;
    areas.push({id:'CA'+areas.length,kind:'connected-colour-area',
      role:areas.length?'supporting':'primary',
      contour:contour,box:bb,x:bb.x+bb.w*.5,y:bb.y+bb.h*.5,
      width:bb.w,height:bb.h,area:area,
      fillFraction:+(area/(bb.w*bb.h)).toFixed(3),
      components:1,occupiedCells:cells.length,gridCell:g.cell,
      palette:palette.slice(0,8),rgb:members[0].rgb.slice(),
      members:members.map(f=>f.id),sources:unique,sourceIndices:unique.slice(),
      seed:A.hash(String(plan.seed)+'|connected|'+i)>>>0,
      // The exact interior mask establishes connectedness, including gaps
      // that would be hidden by a bounding rectangle.
      cells:cells.map(v=>v),
      gridWidth:g.nx,
      protectedVoids:(plan.protectedVoids||[]).map(v=>({x:v.x,y:v.y,w:v.w,h:v.h}))
    });
  }
  return areas;
}
function interpret(source,settings,opts){
  var plan=frozen(source,settings,opts||{});
  plan.connectedFields=colouredAreas(plan.colourFields||[],plan);
  plan.version=VERSION;
  plan.interpretation='connected-colour-areas';
  plan.connectedStats={
    count:plan.connectedFields.length,
    totalArea:plan.connectedFields.reduce((s,f)=>s+f.area,0),
    minFillFraction:plan.connectedFields.length?
      Math.min(...plan.connectedFields.map(f=>f.fillFraction)):0,
    sourceLinked:plan.connectedFields.every(f=>f.sources.length>0),
    allSingleComponent:plan.connectedFields.every(f=>f.components===1)
  };
  return plan;
}
A.compositionV5fFromSource=frozen;
A.planCompositionV5FromSource=interpret;
A.planCompositionV5=function(settings,opts){
  return interpret(A.captureCompositionV5(settings,opts),settings,opts);
};
A.compositionV5Version=VERSION;
A.compositionV5gTest={deriveMask:deriveMask,components:components,
  contourOf:contourOf,colouredAreas:colouredAreas,inside:inside};
})(window.AlgoArt);
