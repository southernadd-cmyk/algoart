// V3-only physical writing plan. V2 glyphs stay immutable.
export const STROKE_PLAN_REVISION='stroke-plan-03';
export function physicalStroke(stroke,family){
 const kind=stroke.kind||'stroke';
 const role=stroke.role==='ornament'?'ornament':stroke.role==='secondary'||kind==='hairline'?'secondary':'primary';
 const width=Number(stroke.width)||6;
 const multiplier=family==='D'?(kind==='hairline'?.72:.73):family==='I'?.80:1;
 return {...stroke,role,width:width*multiplier,
  // A slower start and earlier lift prevent perfectly even marker contact.
  contact:{onset:.045,release:family==='I'?.15:.10}};
}
// Golden-ratio trajectory study: each word generates its own anchored orbit.
// φ controls subdivisions and asymmetric arcs; stable seed perturbations prevent
// mechanical repeats without pushing the marks into letter counters.
const PHI=(1+Math.sqrt(5))/2;
const fmt=n=>Number(n.toFixed(2));
function noise(seed){
 let h=2166136261;for(const ch of String(seed))h=Math.imul(h^ch.charCodeAt(0),16777619);
 return ((h>>>0)/4294967295)*2-1;
}
export function planLoopsOrbit(plan,{mode='restrained',seed=plan.seed||'V3-STUDY'}={}){
 if(!['none','restrained','expressive'].includes(mode))throw new RangeError('Unknown orbit mode');
 if(mode==='none')return [];
 const groups=[];
 for(const letter of plan.letters){
  const previous=groups.at(-1);
  if(!previous||letter.index>previous.at(-1).index+1)groups.push([letter]);
  else previous.push(letter);
 }
 return groups.filter(g=>g.length>=2).map((group,i)=>{
  const left=group[0].x-5,right=group.at(-1).x+79,span=right-left;
  const shift=noise(seed+'|orbit|'+i)*5;
  const shoulder=left+span/(PHI*PHI),crest=left+span/PHI;
  const rise=mode==='expressive'?49:31;
  const top=-14-rise*.42+shift;
  // Open asymmetric curl; all control points remain above letter tops.
  const d=`M ${fmt(left)} ${fmt(32+shift)}
C ${fmt(left-12)} ${fmt(-8+shift)} ${fmt(shoulder-span*.11)} ${fmt(top)} ${fmt(shoulder)} ${fmt(top-7)}
C ${fmt(crest-span*.09)} ${fmt(top-12)} ${fmt(right+span*.03)} ${fmt(top+8)} ${fmt(right)} ${fmt(21+shift)}`;
  return {kind:'stroke',role:'secondary',width:mode==='expressive'?5.3:3.6,d,
   contact:{onset:.08,release:.18},wordGesture:true,wordIndex:i,
   generator:'golden-trajectory-v1'};
 });
}

// φ-guided motion acts INSIDE authored paths, not as an extra decorative line.
// Zero displacement at joins/terminals protects recognisable V2 letter anatomy.
export function movementPoint(x,y,{letterIndex=0,strokeIndex=0,seed='V3',family='G',mode='restrained'}={}){
 if(mode==='none')return {x,y};
 const strengths={A:.8,B:.45,C:.18,D:.16,E:.12,F:.55,G:1,I:.22,H:.2};
 const strength=(strengths[family]||.25)*(mode==='expressive'?1.65:1);
 const phase=letterIndex/PHI+noise(seed+'|'+family+'|'+strokeIndex)*.2;
 const swell=Math.sin(Math.PI*Math.min(1,Math.max(0,y/115)));
 const wave=Math.sin((x/94)*Math.PI*2/PHI+phase);
 return {x:x+strength*1.8*wave*swell,y:y+strength*2.8*wave*swell};
}

// V3 style-specific construction, not a universal displacement.
export function styleMovementPoint(x,y,{family='G',letterIndex=0,strokeIndex=0,seed='V3',mode='restrained',progress=.5}={}){
 if(mode==='none')return {x,y};
 const phi=(1+Math.sqrt(5))/2;
 const n=noise(seed+'|'+family+'|'+letterIndex+'|'+strokeIndex);
 const strength=mode==='expressive'?1.35:1;
 const taper=Math.pow(Math.sin(Math.PI*Math.max(0,Math.min(1,progress))),.7);
 if(family==='G'){
  // Directional rotational pull within each stroke; returns naturally to endpoints.
  const angle=2*Math.PI*(progress/phi+letterIndex/phi**2)+n*.35;
  return {x:x+strength*taper*(3.3*Math.cos(angle)),y:y+strength*taper*(5.5*Math.sin(angle))};
 }
 if(family==='A'){
  // Preserve crossings; reshape only the middle of the stroke.
  return {x:x+strength*taper*.85*n,y:y+strength*taper*.65*Math.sin(progress*Math.PI*2/phi+n)};
 }
 if(family==='H')return {x,y}; // Keep precisely separated filled fragments.
 return movementPoint(x,y,{family,letterIndex,strokeIndex,seed,mode});
}
export function styleWidthMultiplier(family,{mode='marker',role='primary',subtype=null,progress=.5}={}){
 if(family==='A'&&mode==='marker')return role==='primary'?.86:1;
 if(family==='I'&&mode==='marker')return .91;
 if(family==='G')return role==='secondary'?.72:1.18;
 if(family==='F')return subtype==='crossbar'?1.75:subtype==='flourish'?.85:1;
 return 1;
}
