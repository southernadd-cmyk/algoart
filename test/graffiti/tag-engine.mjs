// Procedural writing for PROPORTION PIECE. Original letter centre-lines are
// constructed from phi in phi-lettering.mjs. Ink uses the existing
// A.stroke marker renderer plus a pressure/speed-sensitive continuous ribbon.
import {PHI,goldenMetrics,letterSkeleton} from './phi-lettering.mjs?v=phi-handstyles-v2';
import {drawSpray} from './spray-paint.mjs?v=handstyle-spray-v1';
import {REFERENCE_STUDIES,shapeStudyLetter} from './handstyles.mjs?v=handstyle-spray-v1';
export {REFERENCE_STUDIES,HANDSTYLE_SOURCE} from './handstyles.mjs?v=handstyle-spray-v1';
export {PHI,goldenMetrics,letterSkeleton} from './phi-lettering.mjs?v=phi-handstyles-v2';
export const VERSION = 3;
const U=goldenMetrics().unit;
export const CORE_HANDS = Object.freeze({
 loop:Object.freeze({name:'Loop',description:'Interlocking bowls and a sweeping return stroke.',lean:1/PHI**3,width:1.08,spacing:-U*PHI,weight:6.8,angle:.4,flourish:1}),
 cut:Object.freeze({name:'Cut',description:'Upright, angular counters and broad calligraphic strokes.',lean:1/PHI**6,width:.82,spacing:U/PHI,weight:10.8,angle:-Math.PI/4,flourish:1/PHI}),
 rush:Object.freeze({name:'Rush',description:'Direct, open capitals with quick marker endings.',lean:1/PHI**5,width:.84,spacing:U,weight:5.5,angle:.15,flourish:1/PHI**2})
});
export const HANDS=Object.freeze({...CORE_HANDS,...REFERENCE_STUDIES});
const L=(...ps)=>ps.map(([x,y])=>({x,y}));

export function makeRandom(seed){
 let a=2166136261;
 for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}
 const n=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 return {n,range:(x,y)=>x+(y-x)*n(),int:(x,y)=>Math.floor(x+(y-x+1)*n()),chance:q=>n()<q,pick:xs=>xs[Math.floor(n()*xs.length)]};
}
export function normaliseText(value){
 return String(value??'').normalize('NFKC').replace(/ϕ/g,'φ').toUpperCase().replace(/Φ/g,'φ').replace(/[^A-Z0-9φ .!?-]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
}
function sample(points,smooth){
 const out=[];
 for(let i=0;i<points.length-1;i++){
  const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
  const steps=Math.max(3,Math.ceil(Math.hypot(c.x-b.x,c.y-b.y)/3));
  for(let j=0;j<steps;j++){
   const t=j/steps,t2=t*t,t3=t2*t;
   const coord=k=>smooth?.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3):b[k]+(c[k]-b[k])*t;
   out.push({x:coord('x'),y:coord('y')});
  }
 }
 out.push({...points.at(-1)});return out;
}
function boundsOf(strokes,padding){
 const points=strokes.flatMap(s=>s.points),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const x=Math.min(...xs)-padding,y=Math.min(...ys)-padding;
 return {x,y,width:Math.max(...xs)-x+padding,height:Math.max(...ys)-y+padding};
}
export function createTag(text,{seed='PP-GRAFFITI-01',hand='loop',ink='#232624',ratio=PHI}={}){
 if(!HANDS[hand])throw new RangeError('Unknown handwriting style: '+hand);
 const metrics=goldenMetrics(100,ratio),{height:H,width:W,short:a,long:b,unit:u}=metrics;
 const study=REFERENCE_STUDIES[hand],h=HANDS[hand],family=study?.family||hand;
 const word=normaliseText(text)||'PHI',r=makeRandom(seed+'|'+hand+'|'+word+'|phi-v2');
 const strokes=[],letters=[],lean=h.lean+r.range(-u/H,u/H)*.25;
 const lift=r.range(-1,1)/ratio**7,phase=r.range(0,Math.PI*2);
 let cursor=0;
 const add=(points,kind='letter',weight=1,smooth=true)=>strokes.push({points:sample(points,smooth),kind,weight,phase:r.range(0,Math.PI*2),pressure:r.range(.86,1.12),nib:h.angle+r.range(-.12,.12)});
 // Futura's photographed early tag suggests whole-word movement: an entry,
 // overlapping bowls and one extended return, rather than isolated glyphs.
 if(family==='loop'&&r.chance(1/ratio))add(L([-a,b],[-a/ratio,a],[0,-u],[W/ratio,0]),'entry',.55,true);
 for(let index=0;index<word.length;index++){
  const ch=word[index];if(ch===' '){cursor+=W/ratio;continue;}
  let glyph=letterSkeleton(ch,{hand:family,variant:r.int(0,2),metrics});
  if(study)glyph=shapeStudyLetter(ch,glyph,study,metrics);
  const stretch=r.range(.95,1.05)*(study?.height||1),wide=h.width*r.range(.95,1.05),bounce=(r.range(-u/ratio,u/ratio)+Math.sin(index*ratio+phase)*u/ratio)*(study?.bounce??1);
  const frame={character:ch,x:cursor,wide,stretch,bounce,lean};letters.push(frame);
  const transform=q=>{
   const y=q.y*stretch+bounce;
   return {x:cursor+q.x*wide+(H-y)*lean+Math.sin(q.y/H*Math.PI*2+phase+index)*u/ratio**4,y:y+cursor*lift};
  };
  for(const s of glyph.strokes)add(s.points.map(transform),'letter',study?.id==='revok'&&ch==='R'?1.18:1,s.smooth);
  const advance=Math.max(W/ratio**2,glyph.width*wide+(study?h.spacing*u:h.spacing)+r.range(-u/ratio**2,u/ratio**2));
  if(index<word.length-1&&word[index+1]!==' '&&r.chance(study?.join??(family==='loop'?1/ratio:0))){
   add(L([cursor+advance-u,H*(study?.height||1)-u+cursor*lift],[cursor+advance+u,H*(study?.height||1)+u+cursor*lift],[cursor+advance+W/ratio**2,b*(study?.height||1)+cursor*lift]),'join',1/ratio,family!=='cut');
  }
  cursor+=advance;
 }
 if(study?.shape==='oneline'){
  const writing=strokes.filter(s=>s.kind==='letter'||s.kind==='join');
  const merged=[];
  for(const stroke of writing){
   if(merged.length){const last=merged.at(-1),next=stroke.points[0];merged.push(...sample(L([last.x,last.y],[next.x-u,last.y+u],[next.x,next.y]),true).slice(1));}
   merged.push(...stroke.points);
  }
  const first=writing[0];strokes.splice(0,strokes.length,...strokes.filter(s=>s.kind==='entry'),{...first,kind:'letter',points:merged});
 }
 const baseline=H*(study?.height||1),endY=cursor*lift,under=baseline+W/ratio**2;
 const gesture=study?.gesture||(family==='loop'?'return':family==='cut'?'double':'underline');
 if(gesture==='return'||gesture==='sweep'){
  add(L([-W/ratio,under+u],[cursor/ratio**2,under-u],[cursor/ratio,under-u*ratio],[cursor+W/ratio,under-a/ratio],[cursor+u,under],[cursor/ratio**2,under+u*ratio]),'flourish',.75,true);
 }else if(gesture==='double'){
  add(L([-u,baseline+a/ratio**2],[cursor+u,baseline+a/ratio**2+endY]),'flourish',1/ratio,false);
  add(L([cursor/ratio,baseline+a/ratio**2+endY+u*ratio],[cursor+u,baseline+a/ratio**2+endY+u]),'flourish',1/ratio**2,false);
 }else if(gesture==='circle'){
  add(Array.from({length:37},(_,i)=>{const t=i/36*Math.PI*2;return {x:cursor+W/ratio+Math.cos(t)*W/ratio**2,y:baseline-b/2+Math.sin(t)*b/ratio**2};}),'flourish',1/ratio,true);
 }else if(gesture==='kick'){
  add(L([-u,under],[cursor/ratio,under-u],[cursor+W/ratio,baseline-a/ratio],[cursor+u,under+u]),'flourish',1/ratio,true);
 }else if(gesture==='slash'){
  add(L([-u,under+u],[cursor+W/ratio,baseline+endY]),'flourish',1/ratio,false);
 }else if(gesture==='loop'){
  add(L([-u,under],[cursor/ratio,under-u],[cursor+W/ratio,baseline-a/ratio],[cursor,baseline-b],[cursor-W/ratio,baseline-a],[cursor+u,under]),'flourish',1/ratio,true);
 }else if(gesture==='serif'){
  for(const frame of letters)add(L([frame.x-u,baseline+frame.x*lift],[frame.x+W/ratio**2,baseline-u+frame.x*lift]),'flourish',1/ratio,false);
 }else if(gesture==='frame'){
  add(L([-u,under],[-a,baseline/2],[-u,-u],[cursor+u,-u],[cursor+a,baseline/2],[cursor+u,under]),'flourish',1/ratio,true);
 }else if(gesture==='step'){
  add(L([-u,under],[cursor/ratio**2,under],[cursor/ratio**2,under+u*ratio],[cursor/ratio,under+u*ratio],[cursor/ratio,under],[cursor+u,under]),'flourish',1/ratio,false);
 }else{
  add(L([cursor/ratio**2,baseline+u*ratio],[cursor+u,baseline+endY+u]),'flourish',1/ratio,true);
 }
 const inkR=makeRandom(seed+'|ink'),opacity=inkR.range(.86,.96);
 return {version:VERSION,text:word,seed:String(seed),hand,family,ink,weight:h.weight,sprayFlare:study?.flare||1,opacity,strokes,bounds:boundsOf(strokes,h.weight*Math.max(1.6,(study?.flare||1)*1.6)),construction:{metrics,letters,lift,wordAdvance:cursor,gapUnit:W/ratio**4,returnPoint:cursor/ratio}};
}

function drawRibbon(ctx,stroke,tag,progress){
 const n=Math.min(stroke.points.length,Math.max(2,Math.ceil(stroke.points.length*progress)));
 const points=stroke.points.slice(0,n),left=[],right=[];
 for(let i=0;i<points.length;i++){
  const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy)||1;
  const t=i/(stroke.points.length-1),speed=Math.min(1,len/6),pressure=.81+.16*Math.sin(t*5.1+stroke.phase)+.1*Math.sin(t*11+stroke.phase*.5);
  const taper=.4+.6*Math.min(1,t*13,(1-t)*10);
  const chisel=tag.family==='cut'?.40+.72*Math.abs(Math.sin(Math.atan2(dy,dx)-stroke.nib)):1;
  const width=tag.weight*stroke.weight*stroke.pressure*pressure*(1-.18*speed)*taper*chisel;
  left.push({x:points[i].x-dy/len*width*.5,y:points[i].y+dx/len*width*.5});
  right.push({x:points[i].x+dy/len*width*.5,y:points[i].y-dx/len*width*.5});
 }
 ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);for(const q of left.slice(1))ctx.lineTo(q.x,q.y);for(const q of right.reverse())ctx.lineTo(q.x,q.y);ctx.closePath();ctx.fill();
 return points;
}
// Draw in tag coordinates. Callers choose resolution/placement with ctx.transform.
// A separate RNG per pen movement keeps replay independent of frame rate.
export function drawTag(ctx,tag,{progress=1,marker=globalThis.AlgoArt,finish='spray'}={}){
 if(finish==='spray')return drawSpray(ctx,tag,{progress});
 if(finish!=='marker')throw new RangeError('Unknown paint finish: '+finish);
 if(!marker?.stroke)throw new Error('Load the PROPORTION PIECE marker renderer first.');
 const total=tag.strokes.reduce((n,s)=>n+s.points.length,0),budget=total*Math.max(0,Math.min(1,progress));let used=0;
 ctx.save();ctx.fillStyle=tag.ink;
 for(let k=0;k<tag.strokes.length;k++){
  const s=tag.strokes[k],fraction=Math.min(1,(budget-used)/s.points.length);used+=s.points.length;if(fraction<=0)break;
  ctx.globalAlpha=tag.opacity;
  const points=drawRibbon(ctx,s,tag,fraction);
  // The familiar softly irregular marker pass sits inside the changing-width
  // ribbon. Low wobble is deliberate: a confident hand has coherent motion.
  marker.stroke(ctx,points,tag.ink,{pen:tag.family==='cut'?'broad':'felt',overdraw:1,wobble:1.8,thickness:tag.weight*s.weight*.28,pressure:46,opacity:42,dryness:18},marker.makeR(tag.seed+'|pass|'+k),false);
  // Sparse dry-nib tracks follow the movement, using destination-out only on
  // the transparent ink layer, never on the wall underneath it.
  if(points.length>10){
   const r=makeRandom(tag.seed+'|dry|'+k),offset=r.range(-1,1)*tag.weight*.16;
   ctx.save();ctx.globalCompositeOperation='destination-out';ctx.globalAlpha=.13;ctx.strokeStyle='#000';ctx.lineWidth=.35;
   ctx.beginPath();ctx.moveTo(points[0].x+offset,points[0].y);
   for(const q of points.slice(1))ctx.lineTo(q.x+offset,q.y);ctx.stroke();ctx.restore();
  }
 }
 ctx.restore();return total;
}

const WORDS=Object.freeze(['PHI','ECHO','LOOP','DRIFT','FORM','MARK','GOLD','GHOST','VOID','INK','STILL','TRACE']);
const INKS=Object.freeze(['#242a28','#4c2630','#293849','#e4ddd0','#3e4938']);
// A floor ID is a stable exhibition identity (normally its date), never a
// ground-floor test or the total tower height. Adding floors cannot reshuffle it.
export function planFloorTags({floorId,seed='PP-GRAFFITI-01',text='',hand='mixed',ink='mixed',count='auto'}={}){
 if(floorId===undefined||floorId===null||String(floorId)==='')throw new TypeError('A stable floorId is required.');
 if(hand!=='mixed'&&!HANDS[hand])throw new RangeError('Unknown handwriting style.');
 if(!['auto',1,2,'1','2'].includes(count))throw new RangeError('Each floor must have one or two tags.');
 const key=String(seed)+'|floor|'+String(floorId),r=makeRandom(key+'|count'),n=count==='auto'?(r.chance(.55)?2:1):Number(count);
 return Array.from({length:n},(_,slot)=>{
  const q=makeRandom(key+'|slot|'+slot),writer=hand==='mixed'?q.pick(Object.keys(HANDS)):hand;
  return {id:key+'|'+slot,floorId:String(floorId),slot,hand:writer,text:normaliseText(text)||q.pick(WORDS),ink:ink==='mixed'?q.pick(INKS):ink,seed:key+'|tag|'+slot,
   // Normalised prototype positions; real tower integration will select solid
   // wall segments from each exhibition's room plan before placing these tags.
   x:n===1?.5:slot===0?.28:.73,y:slot===0?.58:.51,scale:q.range(.87,1.06),rotation:q.range(-.07,.055)};
 });
}
