// Procedural writing for PROPORTION PIECE. Original letter centre-lines are
// constructed from phi in phi-lettering.mjs. Ink uses the existing
// A.stroke marker renderer plus a pressure/speed-sensitive continuous ribbon.
import {PHI,goldenMetrics,letterSkeleton} from './phi-lettering.mjs?v=phi-handstyles-v2';
import {drawSpray} from './spray-paint.mjs?v=optical-spray-v6';
import {LETTERING_FORMS,formGlyph,drawSolidForm} from './lettering-forms.mjs?v=sprayed-throwups-v7';
export {LETTERING_FORMS} from './lettering-forms.mjs?v=sprayed-throwups-v7';
import {spaceWord} from './word-spacing.mjs?v=optical-spray-v6';
import {writerIdentity,connectingStroke,orientConnection,connectionClear,planWritingMotion,strokeFraction,tagDuration} from './writing-motion.mjs?v=word-flow-v4';
export {tagDuration,strokeFraction} from './writing-motion.mjs?v=word-flow-v4';
import {REFERENCE_STUDIES,shapeStudyLetter} from './handstyles.mjs?v=artist-grammar-v1';
export {REFERENCE_STUDIES,HANDSTYLE_SOURCE} from './handstyles.mjs?v=artist-grammar-v1';
export {PHI,goldenMetrics,letterSkeleton} from './phi-lettering.mjs?v=phi-handstyles-v2';
export const VERSION = 7;
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
export function createTag(text,{seed='PP-GRAFFITI-01',hand='loop',ink='#232624',ratio=PHI,paintWidth=2,form='handstyle'}={}){
 if(!LETTERING_FORMS[form])throw new RangeError('Unknown lettering form: '+form);
 if(!HANDS[hand])throw new RangeError('Unknown handwriting style: '+hand);
 paintWidth=Number(paintWidth);
 if(!Number.isFinite(paintWidth)||paintWidth<.75||paintWidth>3)throw new RangeError('Paint width must be between 0.75 and 3.');
 const metrics=goldenMetrics(100,ratio),{height:H,width:W,short:a,long:b,unit:u}=metrics;
 const formStyle=LETTERING_FORMS[form],solid=formStyle.solid;
 const study=REFERENCE_STUDIES[hand];
 const original=HANDS[hand],writerFamily=study?.family||hand,writerSpacing=study?original.spacing*u:original.spacing;
 const leanScale=formStyle.round?1:formStyle.piece?.55:formStyle.pixo?.4:solid?.5:1;
 const h={...original,lean:original.lean*leanScale+(formStyle.piece?.10:0),
  spacing:solid?(formStyle.round?formStyle.spacing*.3+writerSpacing*.7:formStyle.spacing+writerSpacing*.5):writerSpacing,
  weight:formStyle.calligraphy?Math.max(14,original.weight*1.5):original.weight};
 const family=formStyle.calligraphy?'cut':formStyle.pixo?'rush':study?.family||hand;
 const word=normaliseText(text)||'PHI',r=makeRandom(seed+'|'+hand+'|'+word+'|phi-v2');
 const identity=writerIdentity(hand,h);
 const strokes=[],letters=[],groups=[],connections=[],lean=h.lean+r.range(-u/H,u/H)*.12;
 const lift=r.range(-1,1)/ratio**7,phase=r.range(0,Math.PI*2),height=r.range(.985,1.015)*(study?.height||1)*(formStyle.height||1),width=h.width*r.range(.985,1.015)*(formStyle.width||1);
 let cursor=0,wordIndex=0;
 const makeStroke=(points,kind='letter',weight=1,smooth=true)=>({points:sample(points,smooth),kind,weight,phase:r.range(0,Math.PI*2),pressure:r.range(.95,1.05),nib:(formStyle.calligraphy?-Math.PI/4:identity.nib)+r.range(-.012,.012)});
 const add=(points,kind='letter',weight=1,smooth=true)=>{const stroke=makeStroke(points,kind,weight,smooth);strokes.push(stroke);return stroke;};
 for(let index=0;index<word.length;index++){
  const ch=word[index];if(ch===' '){cursor+=W/ratio;wordIndex++;continue;}
  const variant=identity.variants[ch];
  let glyph=letterSkeleton(ch,{hand:writerFamily,variant,metrics});
  if(study)glyph=shapeStudyLetter(ch,glyph,study,metrics);
  if(formStyle.calligraphy&&!study&&writerFamily==='loop')glyph=shapeStudyLetter(ch,letterSkeleton(ch,{hand:'loop',variant,metrics}),{id:'calligraphy',shape:'script',width:1,height:1},metrics);
  glyph=formGlyph(ch,glyph,form,metrics);
  const stretch=height*r.range(.993,1.007),wide=width*r.range(.99,1.01),bounce=(r.range(-u/ratio,u/ratio)*.4+Math.sin(index*ratio+phase)*u/ratio)*(study?.bounce??1);
  const frame={character:ch,index,variant,x:cursor,wide,stretch,bounce,lean,baseY:H*stretch+bounce+cursor*lift};letters.push(frame);
  const transform=q=>{const y=q.y*stretch+bounce;return {x:cursor+q.x*wide+(H-y)*lean+Math.sin(q.y/H*Math.PI*2+phase+index)*u/ratio**4,y:y+cursor*lift};};
  const counterLetter=/[ABDGOPQR0689]/.test(ch);
  const counterHeight=/[BPR]/.test(ch)?a*stretch:b*stretch;
  const nozzleLimit=counterLetter?Math.min(W*wide,counterHeight)*.48:0;
  const movements=glyph.strokes.map(s=>({...makeStroke(s.points.map(transform),'letter',study?.id==='revok'&&ch==='R'?1.18:1,s.smooth),nozzleLimit,letterIndex:index}));
  groups.push({character:ch,index,wordIndex,frame,movements});
  cursor+=Math.max(W/ratio**2,glyph.width*wide+h.spacing+r.range(-u/ratio**2,u/ratio**2)*.4);
 }
 const continuous=!solid&&study?.shape==='oneline',joinChance=solid||formStyle.pixo?0:study?.join??(family==='loop'?1/ratio:0);
 const spacing=solid?{pairs:[],shift:0}:spaceWord(groups,{unit:u,ratio,weight:h.weight,lift,joinChance});cursor+=spacing.shift;
 if(!solid&&!formStyle.pixo)for(let i=0;i<groups.length-1;i++){
  const from=groups[i],to=groups[i+1];if(from.wordIndex!==to.wordIndex)continue;
  if(!continuous&&!makeRandom('writer|'+hand+'|join|'+from.character+to.character).chance(joinChance))continue;
  const last=from.movements.at(-1),first=to.movements[0],oldLast=last.points,oldFirst=first.points;
  orientConnection(last,first,{lockFrom:!!from.incoming&&from.movements.length===1});
  const start=last.points.at(-1),end=first.points[0];
  const lowEnough=start.y>=from.frame.baseY-H*from.frame.stretch*.58&&end.y>=to.frame.baseY-H*to.frame.stretch*.58;
  const points=continuous||lowEnough?connectingStroke(last,first,{unit:u,force:continuous}):null;
  if(!points||(!continuous&&!connectionClear(points,[...from.movements,...to.movements],u))){last.points=oldLast;first.points=oldFirst;continue;}
  to.incoming=makeStroke(points,'join',1/ratio,false);
  connections.push({from:from.index,to:to.index,start:{...start},end:{...end}});
 }
 // A writer's entry flourish finishes exactly at the first real pen contact.
 if(!solid&&family==='loop'&&makeRandom('writer|'+hand+'|entry').chance(1/ratio)){
  const first=groups[0].movements[0].points[0];
  add(L([first.x-a,first.y+b/ratio],[first.x-a/ratio,first.y-u],[first.x-u,first.y-u],[first.x,first.y]),'entry',.55,true);
 }
 if(continuous){
  let writing=[],currentWord=-1;
  const flush=()=>{
   if(!writing.length)return;
   const merged=[];
   for(const movement of writing){
    if(merged.length){const connector=connectingStroke({points:merged},movement,{unit:u,force:true});merged.push(...connector.slice(1));}
    merged.push(...movement.points);
   }
   strokes.push({...writing[0],kind:'letter',points:merged});writing=[];
  };
  for(const group of groups){if(currentWord!==group.wordIndex){flush();currentWord=group.wordIndex;}if(group.incoming)writing.push(group.incoming);writing.push(...group.movements);}flush();
 }else{
  for(const group of groups){if(group.incoming)strokes.push(group.incoming);strokes.push(...group.movements);}
 }
 const body=boundsOf(strokes.filter(s=>s.kind!=='entry'),0);
 const baseline=body.y+body.height,endY=0,under=baseline+u*ratio;
 cursor=Math.max(cursor,body.x+body.width);
 if(!solid&&!formStyle.pixo){
 const gesture=study?.gesture||(family==='loop'?'return':family==='cut'?'double':'underline');
 if(gesture==='return'||gesture==='sweep'){
  add(L([body.x-u,under+u],[cursor/ratio**2,under],[cursor/ratio,under-u/ratio],[cursor+W/ratio,under+u/ratio],[cursor+u,under+u*ratio],[cursor/ratio**2,under+u*ratio]),'flourish',1/ratio,true);
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
  add(L([body.x,under],[cursor/ratio,under],[cursor+W/ratio,under],[cursor+W/ratio,baseline-a],[cursor+u,baseline-a/ratio],[cursor+W/ratio,under+u]),'flourish',1/ratio,true);
 }else if(gesture==='serif'){
  for(const frame of [letters[0],letters.at(-1)])add(L([frame.x-u,frame.baseY+u],[frame.x+W/ratio**2,frame.baseY]),'flourish',1/ratio,false);
 }else if(gesture==='frame'){
  const top=body.y+body.height/ratio**2,bottom=body.y+body.height/ratio;
  add(L([body.x-u,top-u],[body.x-u*ratio,top],[body.x-u*ratio,bottom],[body.x-u,bottom+u]),'flourish',1/ratio**2,true);
  add(L([cursor+u,top-u],[cursor+u*ratio,top],[cursor+u*ratio,bottom],[cursor+u,bottom+u]),'flourish',1/ratio**2,true);
 }else if(gesture==='step'){
  add(L([-u,under],[cursor/ratio**2,under],[cursor/ratio**2,under+u*ratio],[cursor/ratio,under+u*ratio],[cursor/ratio,under],[cursor+u,under]),'flourish',1/ratio,false);
 }else{
  add(L([cursor/ratio**2,baseline+u*ratio],[cursor+u,baseline+endY+u]),'flourish',1/ratio,true);
 }
 // Small, repeatable accents belong to the writer; keep them outside the
 // letter bodies and subordinate to the primary closing movement.
 const accentX=body.x+body.width+u*ratio,accentY=body.y-u*ratio;
 if(identity.accent==='dots')for(let i=0;i<3;i++)add(Array.from({length:13},(_,j)=>{const t=j/12*Math.PI*2;return {x:accentX+i*u*.85+Math.cos(t)*u*.12,y:accentY+Math.sin(t)*u*.12};}),'accent',.35,true);
 if(identity.accent==='dash')add(L([accentX,accentY],[accentX+u*ratio,accentY-u/ratio]),'accent',1/ratio**2,false);
 if(identity.accent==='quotes')for(let i=0;i<2;i++)add(L([accentX+i*u,accentY-u/ratio],[accentX+i*u-u/ratio,accentY+u/ratio]),'accent',1/ratio**2,false);
 }
 const extensions=[];
 if(formStyle.piece){
  const y=body.y+body.height/ratio;
  extensions.push({at:.88,points:L([body.x+u,y],[body.x-a,y+u*ratio],[body.x+u,y+u*ratio*2])});
  extensions.push({at:.96,points:L([body.x+body.width-u,body.y+b/ratio],[body.x+body.width+a,body.y-u],[body.x+body.width,body.y+b])});
 }
 const motion=planWritingMotion(strokes,{pace:identity.pace});
 const inkR=makeRandom(seed+'|ink'),opacity=inkR.range(.86,.96);
 const padding=Math.max(h.weight*paintWidth*Math.max(1.6,(study?.flare||1)*1.6),solid?(formStyle.bar+formStyle.outline*2)*paintWidth/2+12:0);
 const boundStrokes=extensions.length?[...strokes,...extensions]:strokes;
 return {version:VERSION,form,extensions,text:word,seed:String(seed),hand,family,writer:identity,flow:{connections},spacing,motion,ink,paintWidth,baseWeight:h.weight,weight:h.weight*paintWidth,sprayFlare:study?.flare||1,opacity,strokes,bounds:boundsOf(boundStrokes,padding),construction:{metrics,letters,lift,wordAdvance:cursor,gapUnit:W/ratio**4,returnPoint:cursor/ratio}};
}

function drawRibbon(ctx,stroke,tag,progress,movement){
 const n=Math.min(stroke.points.length,Math.max(2,Math.ceil(stroke.points.length*progress)));
 const points=stroke.points.slice(0,n),left=[],right=[];
 for(let i=0;i<points.length;i++){
  const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy)||1;
  const t=i/(stroke.points.length-1),speed=movement?.speeds[i]??Math.min(1,len/6),pressure=.81+.16*Math.sin(t*5.1+stroke.phase)+.1*Math.sin(t*11+stroke.phase*.5);
  const taper=.4+.6*Math.min(1,t*13,(1-t)*10);
  const chisel=tag.form==='calligraphy'?.15+1.15*Math.abs(Math.sin(Math.atan2(dy,dx)-stroke.nib)):tag.family==='cut'?.40+.72*Math.abs(Math.sin(Math.atan2(dy,dx)-stroke.nib)):1;
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
 if(!['spray','marker'].includes(finish))throw new RangeError('Unknown paint finish: '+finish);
 if(LETTERING_FORMS[tag.form]?.solid){drawSolidForm(ctx,tag,{progress,fractionAt:strokeFraction,finish});return tagDuration(tag);}
 if(finish==='spray')return drawSpray(ctx,tag,{progress});
 if(!marker?.stroke)throw new Error('Load the PROPORTION PIECE marker renderer first.');
 const total=tagDuration(tag);
 ctx.save();ctx.fillStyle=tag.ink;
 for(let k=0;k<tag.strokes.length;k++){
  const s=tag.strokes[k],fraction=strokeFraction(tag,k,progress);if(fraction<=0)break;
  ctx.globalAlpha=tag.opacity;
  const points=drawRibbon(ctx,s,tag,fraction,tag.motion?.strokes[k]);
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
export function planFloorTags({floorId,seed='PP-GRAFFITI-01',text='',hand='mixed',ink='mixed',form='handstyle',count='auto'}={}){
 if(floorId===undefined||floorId===null||String(floorId)==='')throw new TypeError('A stable floorId is required.');
 if(form!=='mixed'&&!LETTERING_FORMS[form])throw new RangeError('Unknown lettering form.');
 if(hand!=='mixed'&&!HANDS[hand])throw new RangeError('Unknown handwriting style.');
 if(!['auto',1,2,'1','2'].includes(count))throw new RangeError('Each floor must have one or two tags.');
 const key=String(seed)+'|floor|'+String(floorId),r=makeRandom(key+'|count'),n=count==='auto'?(r.chance(.55)?2:1):Number(count);
 return Array.from({length:n},(_,slot)=>{
  const q=makeRandom(key+'|slot|'+slot),writer=hand==='mixed'?q.pick(Object.keys(HANDS)):hand;
  return {id:key+'|'+slot,floorId:String(floorId),slot,hand:writer,form:form==='mixed'?makeRandom(key+'|form|'+slot).pick(Object.keys(LETTERING_FORMS)):form,text:normaliseText(text)||q.pick(WORDS),ink:ink==='mixed'?q.pick(INKS):ink,seed:key+'|tag|'+slot,
   // Normalised prototype positions; real tower integration will select solid
   // wall segments from each exhibition's room plan before placing these tags.
   x:n===1?.5:slot===0?.28:.73,y:slot===0?.58:.51,scale:q.range(.87,1.06),rotation:q.range(-.07,.055)};
 });
}
