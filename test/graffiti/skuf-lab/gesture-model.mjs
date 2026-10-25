// SKUF laboratory: editable cubic strokes and time-based gesture playback.
// Original implementation; inspired by kinematic handwriting research and GML,
// without copying third-party source or claiming inferred motion is observed.
import {planSkufName} from '../skuf-word-study.mjs';
export const FORMAT='pp-graffiti-strokes/1';
const finite=n=>Number.isFinite(n);
const point=(x,y)=>({x,y});
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function tokens(path){return String(path).match(/[MCQL]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g)||[]}
/** Import legacy authored SVG paths into editable cubic anchors; does not infer stroke order. */
export function cubicKnots(path,xOffset=0){
 const ts=tokens(path),knots=[];let i=0,cmd='';
 const num=()=>{const n=Number(ts[i++]);if(!finite(n))throw new RangeError('Invalid path number');return n};
 while(i<ts.length){
  if(/[MCQL]/.test(ts[i]))cmd=ts[i++];
  if(cmd==='M'){const x=num()+xOffset,y=num();knots.push({x,y,in:null,out:null});cmd='L';}
  else if(cmd==='L'){const x=num()+xOffset,y=num();knots.push({x,y,in:null,out:null});}
  else if(cmd==='C'){
   if(!knots.length)throw new RangeError('Curve without a start');
   const c1=point(num()+xOffset,num()),c2=point(num()+xOffset,num()),end=point(num()+xOffset,num());
   knots.at(-1).out=c1;knots.push({...end,in:c2,out:null});
  }else if(cmd==='Q'){
   if(!knots.length)throw new RangeError('Quadratic without start');
   const q=point(num()+xOffset,num()),end=point(num()+xOffset,num()),a=knots.at(-1);
   a.out=point(a.x+2/3*(q.x-a.x),a.y+2/3*(q.y-a.y));
   knots.push({...end,in:point(end.x+2/3*(q.x-end.x),end.y+2/3*(q.y-end.y)),out:null});
  }else throw new RangeError('Unsupported SVG command '+cmd);
 }
 if(knots.length<2)throw new RangeError('A stroke requires two knots');
 return knots;
}
export function initialDocument(){
 const strokes=[];
 const word=planSkufName();
 for(const letter of word.characters)for(const [i,path] of letter.paths.entries()){
  strokes.push({id:letter.ch+(i+1),letter:letter.ch,knots:cubicKnots(path,letter.x),
   durationMs:i===0?620:300,pressure:.85,liftAfter:true,confidence:'inferred',
   note:'Legacy study path; NOT matched to a specific reference photograph.'});
 }
 return {format:FORMAT,writer:'skuf-study',revision:0,label:'Unapproved reference-led starting sketch',strokes};
}
export function validateDocument(doc){
 if(!doc||doc.format!==FORMAT||!Array.isArray(doc.strokes)||doc.strokes.length>300)throw new RangeError('Invalid document format');
 const ids=new Set();
 for(const s of doc.strokes){
  if(typeof s.id!=='string'||!s.id||ids.has(s.id)||s.id.length>40)throw new RangeError('Duplicate or invalid stroke ID');
  ids.add(s.id);
  if(!Array.isArray(s.knots)||s.knots.length<2||s.knots.length>200)throw new RangeError('Invalid stroke knots');
  if(!finite(s.durationMs)||s.durationMs<80||s.durationMs>30000)throw new RangeError('Invalid duration');
  if(!finite(s.pressure)||s.pressure<.1||s.pressure>2)throw new RangeError('Invalid pressure');
  if(typeof s.liftAfter!=='boolean')throw new RangeError('Missing contact decision');
  for(const k of s.knots)for(const p of [k,k.in,k.out].filter(Boolean))
   if(!finite(p.x)||!finite(p.y)||Math.abs(p.x)>1e5||Math.abs(p.y)>1e5)throw new RangeError('Invalid coordinate');
 }
 return doc;
}
export function pathD(stroke){
 const a=stroke.knots;if(!a?.length)return '';
 let d='M '+a[0].x.toFixed(2)+' '+a[0].y.toFixed(2);
 for(let i=1;i<a.length;i++){
  const p=a[i-1],q=a[i];
  const c1=p.out||point(lerp(p.x,q.x,1/3),lerp(p.y,q.y,1/3));
  const c2=q.in||point(lerp(p.x,q.x,2/3),lerp(p.y,q.y,2/3));
  d+=' C '+[c1.x,c1.y,c2.x,c2.y,q.x,q.y].map(n=>n.toFixed(2)).join(' ');
 }
 return d;
}
function cubic(a,b,c,d,t){
 const v=1-t;return point(v*v*v*a.x+3*v*v*t*b.x+3*v*t*t*c.x+t*t*t*d.x,
                         v*v*v*a.y+3*v*v*t*b.y+3*v*t*t*c.y+t*t*t*d.y);
}
function tableForStroke(stroke){
 const positions=[],knots=stroke.knots;let length=0,last=null;
 for(let i=1;i<knots.length;i++){
  const a=knots[i-1],d=knots[i],b=a.out||point(lerp(a.x,d.x,1/3),lerp(a.y,d.y,1/3)),c=d.in||point(lerp(a.x,d.x,2/3),lerp(a.y,d.y,2/3));
  const steps=Math.max(15,Math.min(100,Math.ceil(dist(a,d)/2)));
  for(let j=i===1?0:1;j<=steps;j++){
   const p=cubic(a,b,c,d,j/steps);
   if(last)length+=dist(last,p);
   positions.push({...p,distance:length});last=p;
  }
 }
 return {positions,length};
}
function along(table,s){
 const target=table.length*clamp(s,0,1),a=table.positions;
 let lo=0,hi=a.length-1;
 while(lo<hi){const m=(lo+hi)>>1;if(a[m].distance<target)lo=m+1;else hi=m}
 const next=a[lo],prev=a[Math.max(0,lo-1)],delta=next.distance-prev.distance;
 return point(lerp(prev.x,next.x,delta?clamp((target-prev.distance)/delta,0,1):0),
              lerp(prev.y,next.y,delta?clamp((target-prev.distance)/delta,0,1):0));
}
// Minimum-jerk travel gives zero boundary velocity/acceleration; endpoints
// reflect a deliberate slow start/stop, not uniform-distance fake timing.
export const minimumJerk=u=>{const x=clamp(u,0,1);return x*x*x*(10+x*(-15+6*x))};
function seeded(seed){let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h=(h+0x6d2b79f5)|0;let t=Math.imul(h^h>>>15,1|h);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296}}
/** Samples with explicit milliseconds; lifts are separate contact:false events. */
export function simulateDocument(doc,{seed='PP-SKUF-LAB-01',stepMs=12}={}){
 validateDocument(doc);
 if(!finite(stepMs)||stepMs<3||stepMs>100)throw new RangeError('Invalid step');
 const random=seeded(seed),events=[];let clock=0,previous=null;
 for(const [strokeIndex,stroke] of doc.strokes.entries()){
  const table=tableForStroke(stroke);
  if(table.length<1)continue;
  const start=table.positions[0],end=table.positions.at(-1);
  if(previous){
   const prior=doc.strokes[strokeIndex-1],transfer=dist(previous,start);
   if(prior.liftAfter){
    const travelMs=clamp(transfer/1.5,45,500);
    events.push({x:previous.x,y:previous.y,t:clock,contact:false,strokeId:null,speed:0,pressure:0});
    clock+=travelMs;
    events.push({x:start.x,y:start.y,t:clock,contact:false,strokeId:null,speed:0,pressure:0});
   }else if(transfer>2)throw new RangeError('Unjoined strokes cannot remain in contact: '+prior.id);
  }
  const duration=stroke.durationMs*(.975+random()*.05),pressureScale=.97+random()*.06;
  let prevPoint=null,prevSpeed=0;
  const steps=Math.max(8,Math.ceil(duration/stepMs));
  for(let i=0;i<=steps;i++){
   const u=i/steps,s=minimumJerk(u),p=along(table,s),t=clock+duration*u;
   const dt=duration/steps,speed=prevPoint?dist(prevPoint,p)/dt:0;
   // Pressure is a separate motor control, not a function of point spacing.
   const pressure=stroke.pressure*pressureScale*(.68+.32*Math.pow(Math.max(0,Math.sin(Math.PI*u)),.55));
   events.push({...p,t,speed,acceleration:(speed-prevSpeed)/dt,pressure,contact:true,
    strokeId:stroke.id,letter:stroke.letter,progress:s});
   prevPoint=p;prevSpeed=speed;
  }
  clock+=duration;
  previous=end;
  if(stroke.liftAfter){events.push({x:end.x,y:end.y,t:clock+.01,speed:0,pressure:0,contact:false,strokeId:null});clock+=.01}
  // If liftAfter is false, the next stroke is allowed only when its starting
  // anchor meets this endpoint. This is validated on the next iteration.
 }
 return {events,durationMs:clock,strokeCount:doc.strokes.length};
}
export function ribbonForStroke(events,{width=7.5}={}){
 const pts=events.filter(p=>p.contact);if(pts.length<2)return '';
 const left=[],right=[];
 for(let i=0;i<pts.length;i++){
  const p=pts[i],a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y;
  const len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,r=width*p.pressure/2;
  left.push([p.x+nx*r,p.y+ny*r]);right.unshift([p.x-nx*r,p.y-ny*r]);
 }
 return 'M'+[...left,...right].map(([x,y])=>x.toFixed(2)+','+y.toFixed(2)).join('L')+'Z';
}
