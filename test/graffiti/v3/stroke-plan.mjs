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
// Whole-word orbit: a single open, directional gesture ABOVE and around the
// phrase, not a baseline strike-through or a concentric ellipse around letters.
export function planLoopsOrbit(plan){
 const letters=plan.letters;
 if(letters.length<3)return [];
 const first=letters[0],last=letters.at(-1);
 const left=first.x-12,right=last.x+76,span=right-left;
 if(span<=0)return [];
 return [{
  kind:'stroke',role:'secondary',width:5.5,
  d:`M ${left} 79 C ${left+span*.04} 1 ${left+span*.28} -21 ${left+span*.49} -8 S ${right+19} 11 ${right} 72`,
  contact:{onset:.10,release:.2},wordGesture:true
 }];
}
