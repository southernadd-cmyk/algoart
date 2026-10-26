// V3-only physical writing plan. V2 glyphs stay immutable.
export const STROKE_PLAN_REVISION='stroke-plan-01';
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
