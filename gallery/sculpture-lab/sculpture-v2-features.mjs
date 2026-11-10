// PROPORTION PIECE — Sculpture Lab v2: source analysis, not a silhouette extrusion.
// All values are deterministic. Coordinates are the existing 1.34 x 1.88 portrait space.
import {extractRuleMarks} from './sculpture-rules.mjs';

export const PHI=(1+Math.sqrt(5))/2;
export const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function resample(points,max=14){
  if(points.length<=max)return points.map(p=>({x:p.x,y:p.y}));
  return Array.from({length:max},(_,i)=>{
    const p=points[Math.round(i*(points.length-1)/(max-1))];
    return {x:p.x,y:p.y};
  });
}
function pixelColour(imageData,x,y){
  const w=imageData.width,h=imageData.height;
  const ix=clamp(Math.round((x/1.34+.5)*(w-1)),0,w-1);
  const iy=clamp(Math.round((.5-y/1.88)*(h-1)),0,h-1);
  const k=4*(iy*w+ix);
  return '#'+[0,1,2].map(i=>imageData.data[k+i].toString(16).padStart(2,'0')).join('');
}
function strokeLength(points){
  let l=0;for(let j=1;j<points.length;j++)
    l+=Math.hypot(points[j].x-points[j-1].x,points[j].y-points[j-1].y);
  return l;
}
function localGestures(marks){
  // When a recording is unavailable use *colour-labelled mark orientations*,
  // never outline the image and never create a projection plane.
  return marks.slice(0,28).map((m,i)=>{
    const vx=Math.cos(m.angle),vy=Math.sin(m.angle),r=clamp(m.span*.8,.10,.47);
    const points=[-1,-.5,0,.5,1].map(t=>({
      x:clamp(m.x+vx*r*t,-.65,.65),
      y:clamp(m.y+vy*r*t,-.92,.92)
    }));
    return {id:'inferred-'+i,source:'pigment-region',points,color:m.color,
      width:clamp(m.breadth*.38,.015,.09),weight:m.mass,
      length:strokeLength(points),role:'gesture'};
  });
}
export function buildSourceFeatures(imageData,{
  material='marker',paper='#f5f0e6',strokes=[],maxRegions=26,maxGestures=25
}={}){
  const marks=extractRuleMarks(imageData,{material,paper}).slice(0,90);
  const total=marks.reduce((v,m)=>v+m.mass,0)||1;
  const regions=marks.slice(0,maxRegions).map((m,i)=>({
    id:'region-'+i,source:'actual-pigment',x:m.x,y:m.y,
    color:m.color,weight:m.mass/total,
    span:clamp(m.span,.08,.52),breadth:clamp(m.breadth,.045,.31),
    orientation:m.angle,kind:m.kind,coverage:m.coverage,
    role:i<5?'primary':i<13?'secondary':'accent'
  }));
  const recordedCount=strokes.filter(s=>s.sourceKind!=='pigment-contour').length;
  const original=strokes.filter(s=>Array.isArray(s.points)&&s.points.length>1&&
    Number.isFinite(s.points[0].x)&&Number.isFinite(s.points[0].y))
    .map((s,i)=>{
      const points=resample(s.points,19);
      const length=strokeLength(points);
      return {id:'recorded-'+i,
        source:s.sourceKind==='pigment-contour'?'visible-pigment-contour':'actual-recording',points,
        color:s.color||pixelColour(imageData,points[0].x,points[0].y),
        width:clamp(s.width||.015,.008,.095),
        length,weight:(s.score||length)*Math.max(.2,s.coverage??1),
        role:'gesture',sourceIndex:s.sourceIndex??i};
    }).filter(s=>s.length>.035)
    .sort((a,b)=>b.weight-a.weight||a.sourceIndex-b.sourceIndex);
  // Spread the gestures across the source rather than overemphasising the
  // strongest ink cluster. Recorded gestures take priority when available.
  const source=original.length>=3?original:
    [...original,...localGestures(marks)];
  const zones=new Set(),chosen=[];
  for(const g of source){
    const p=g.points[Math.floor(g.points.length/2)];
    const zone=Math.floor((p.x+.67)/.28)+8*Math.floor((p.y+.94)/.35);
    if(!zones.has(zone)||chosen.length>=Math.ceil(maxGestures*.65)){
      chosen.push(g);zones.add(zone);
    }
    if(chosen.length>=maxGestures)break;
  }
  if(chosen.length<3)chosen.push(...localGestures(marks).slice(0,3-chosen.length));
  const centre=regions.slice(0,Math.min(12,regions.length)).reduce(
    (v,m)=>({x:v.x+m.x*m.weight,y:v.y+m.y*m.weight,w:v.w+m.weight}),
    {x:0,y:0,w:0});
  return {
    version:2,material,paper,sourceWidth:imageData.width,
    sourceHeight:imageData.height,
    sourceKind:original.length>=1?
      (recordedCount>=1?'recorded-gestures-and-pigment':'visible-pigment-contours'):
      'pigment-regions',
    centre:{x:centre.x/(centre.w||1),y:centre.y/(centre.w||1)},
    regions,gestures:chosen.slice(0,maxGestures),
    anchors:regions.slice(0,8).map(r=>({id:r.id,x:r.x,y:r.y,weight:r.weight})),
    counts:{originalStrokes:original.length,pigmentRegions:marks.length}
  };
}
