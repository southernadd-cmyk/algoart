// Original, dependency-free movement renderer for the isolated SKUF study.
// No code or weights from third-party handwriting projects are included.
import {planSkufName} from './skuf-word-study.mjs';
function random(seed){let n=2166136261;for(const c of String(seed)){n=Math.imul(n^c.charCodeAt(0),16777619)}return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function velocityWidths(points,{base=8,contrast=.62}={}){
 if(points.length<2)return points.map(p=>({...p,width:base}));
 return points.map((p,i)=>{
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
  const span=Math.hypot(b.x-a.x,b.y-a.y)||1;
  const curvature=i>0&&i<points.length-1?Math.abs(Math.atan2(points[i+1].y-p.y,points[i+1].x-p.x)-Math.atan2(p.y-points[i-1].y,p.x-points[i-1].x)):0;
  // Narrow through fast straight sections; settle and widen at turns.
  const pace=clamp(span/11,.2,1.6);
  const turn=Math.min(1,Math.abs(Math.atan2(Math.sin(curvature),Math.cos(curvature)))/1.6);
  const pressure=clamp(1+contrast*(.5-pace*.40)+turn*.24,.48,1.5);
  return {...p,width:base*pressure};
 });
}
export function ribbonOutline(points){
 if(points.length<2)return '';
 const left=[],right=[];
 for(let i=0;i<points.length;i++){
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
  const nx=-dy/length,ny=dx/length,r=points[i].width/2;
  left.push([points[i].x+nx*r,points[i].y+ny*r]);
  right.unshift([points[i].x-nx*r,points[i].y-ny*r]);
 }
 return 'M'+[...left,...right].map(p=>p.map(n=>n.toFixed(2)).join(',')).join('L')+'Z';
}
export function movementPlan(seed='PP-SKUF-01'){
 const r=random(seed),plan=planSkufName(),strokes=[];
 for(const letter of plan.characters)for(let i=0;i<letter.paths.length;i++){
  strokes.push({letter:letter.ch,source:letter.paths[i],x:letter.x,
   base:7.4+r()*3.2,phase:r()*Math.PI*2,offset:r()*1.8,
   liftAfter:true});
 }
 return strokes;
}
export function drawMovementSvg(seed='PP-SKUF-01',{contrast=.62}={}){
 if(typeof document==='undefined')throw new Error('SVG path measurement requires a browser document');
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');
 svg.setAttribute('viewBox','-20 -20 375 165');svg.setAttribute('role','img');svg.setAttribute('aria-label','SKUF movement and pressure study');
 const group=document.createElementNS(NS,'g');svg.append(group);
 for(const spec of movementPlan(seed)){
  const guide=document.createElementNS(NS,'path');guide.setAttribute('d',spec.source);
  const length=guide.getTotalLength(),count=Math.max(10,Math.ceil(length/3)),points=[];
  for(let i=0;i<=count;i++){const p=guide.getPointAtLength(length*i/count);points.push({x:p.x+spec.x,y:p.y+Math.sin(i/count*Math.PI*2+spec.phase)*spec.offset*(Math.sin(i/count*Math.PI)**2)})}
  const enriched=velocityWidths(points,{base:spec.base,contrast});
  const path=document.createElementNS(NS,'path');path.setAttribute('d',ribbonOutline(enriched));
  path.setAttribute('fill','#29312e');path.setAttribute('stroke','none');path.dataset.letter=spec.letter;group.append(path);
 }
 return svg;
}
