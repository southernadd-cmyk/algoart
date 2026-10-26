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
// Keep the original readable glyphs intact. Each word has its own orbit;
// no stroke bridges a space or runs horizontally through its baseline.
export function planLoopsOrbit(plan,{mode='restrained'}={}){
 if(!['none','restrained','expressive'].includes(mode))throw new RangeError('Unknown orbit mode');
 if(mode==='none')return [];
 const groups=[];
 for(const letter of plan.letters){
  const previous=groups.at(-1);
  if(!previous||letter.index>previous.at(-1).index+1)groups.push([letter]);
  else previous.push(letter);
 }
 return groups.filter(g=>g.length>=2).map((group,i)=>{
  const left=group[0].x-9,right=group.at(-1).x+82,span=right-left;
  const lift=mode==='expressive'?25:15;
  const y=mode==='expressive'?-22:-15;
  const d=`M ${left.toFixed(2)} 36 C ${(left+span*.08).toFixed(2)} ${y} ${(left+span*.35).toFixed(2)} ${(y-lift).toFixed(2)} ${(left+span*.58).toFixed(2)} ${(y+5).toFixed(2)} S ${(right+span*.07).toFixed(2)} ${(y+lift*.5).toFixed(2)} ${right.toFixed(2)} 20`;
  return {kind:'stroke',role:'secondary',width:mode==='expressive'?5:3.5,d,
   contact:{onset:.08,release:.18},wordGesture:true,wordIndex:i};
 });
}
