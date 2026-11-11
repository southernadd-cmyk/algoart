// PROPORTION PIECE Sculpture Lab V3 — exact visible-pigment contour fallback.
// This is NOT a guessed line between pigment centroids. Edges are read from
// the final archived artwork, using the material-specific pigment mask.
import {pigmentField} from './material-surface.mjs';
import {smoothClosedContour} from './sculpture-v3-finishing.mjs';
const W=1.34,H=1.88;
const key=(x,y)=>x+','+y;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function traceVisiblePigmentContours(imageData,{
  material='marker',paper='#f5f0e6',maxPaths=105
}={}){
  const field=pigmentField(imageData,{material,paper});
  const w=field.width,h=field.height,ink=field.occupancy;
  const isPainted=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&ink[y*w+x]===1;
  const edges=[],byStart=new Map();
  function add(ax,ay,bx,by){
    const e={ax,ay,bx,by,used:false};
    edges.push(e);
    const k=key(ax,ay);
    if(!byStart.has(k))byStart.set(k,[]);
    byStart.get(k).push(e);
  }
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(!isPainted(x,y))continue;
    if(!isPainted(x,y-1))add(x,y,x+1,y);
    if(!isPainted(x+1,y))add(x+1,y,x+1,y+1);
    if(!isPainted(x,y+1))add(x+1,y+1,x,y+1);
    if(!isPainted(x-1,y))add(x,y+1,x,y);
  }
  const loops=[];
  for(const first of edges){
    if(first.used)continue;
    const coords=[],origin=key(first.ax,first.ay);
    let edge=first,closed=false;
    for(let steps=0;edge&&steps<edges.length;steps++){
      edge.used=true;
      coords.push([edge.ax,edge.ay]);
      const dest=key(edge.bx,edge.by);
      if(dest===origin){closed=true;break;}
      edge=(byStart.get(dest)||[]).find(e=>!e.used);
    }
    if(!closed||coords.length<12)continue;
    let signed=0,perimeter=0;
    for(let i=0;i<coords.length;i++){
      const a=coords[i],b=coords[(i+1)%coords.length];
      signed+=a[0]*b[1]-a[1]*b[0];
      perimeter+=Math.hypot(b[0]-a[0],b[1]-a[1]);
    }
    const area=Math.abs(signed)*.5;
    if(area<9||perimeter<18)continue;
    const sample=coords[Math.floor(coords.length/4)];
    let colour='#685b4d';
    outer:for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const x=clamp(Math.round(sample[0]+dx),0,w-1);
      const y=clamp(Math.round(sample[1]+dy),0,h-1);
      if(isPainted(x,y)){
        const p=(y*w+x)*4;
        colour='#'+[0,1,2].map(k=>imageData.data[p+k].toString(16).padStart(2,'0')).join('');
        break outer;
      }
    }
    // Retain the TRUE pigment silhouette, but remove one-pixel stair steps.
    // Closed-loop resampling keeps its topology instead of inventing strokes.
    const selected=smoothClosedContour(coords,{
      passes:3,spacing:2.2,maxPoints:82
    });
    const points=selected.map(([x,y])=>({
      x:(x/w-.5)*W,y:(.5-y/h)*H
    }));
    if(points.length<3)continue;
    // The finishing utility already returns a closed contour.
    loops.push({
      sourceKind:'pigment-contour',
      sourceIndex:loops.length,
      points,color:colour,
      width:Math.max(.004,Math.min(.012,.008*Math.sqrt(area/100))),
      coverage:1,score:Math.sqrt(area)*1.4+.025*perimeter,
      length:perimeter*Math.min(W/w,H/h),
      area,perimeter
    });
  }
  // Retain substantial marks first, including small but long thin strokes.
  loops.sort((a,b)=>b.score-a.score||b.perimeter-a.perimeter);
  return loops.slice(0,maxPaths);
}
