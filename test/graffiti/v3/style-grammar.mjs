// Experimental family-aware word construction. Production and V2 remain immutable.
import {composeLoopsWord} from './loops-library.mjs';
import {composeBroadNib} from './broadnib-library.mjs?v=nib-clusters-03';
import {composeRectilinear} from './rectilinear-library.mjs';
export const GRAMMAR_REVISION='family-composition-04';
export const RULES=Object.freeze({
 A:{name:'interlocked',pairs:['PR','RO','OP','OR','PI','IE'],curvature:.36,width:5.0},
 B:{name:'arrow-cross',pairs:['PR','RO','RT','TI','IE'],curvature:-.55,width:2.7},
 C:{name:'cut-wedge',pairs:['PR','RO','OP','PI','EC'],curvature:.12,width:4.0},
 D:{name:'rectilinear-block',pairs:['PR','RT','TI','ON','IE'],curvature:0,width:4.1},
 E:{name:'gothic',pairs:['PR','RO','RT','TI','IE'],curvature:-.3,width:3.5},
 F:{name:'broad-nib',pairs:['PR','RO','OP','PI','IE'],curvature:.8,width:5.8},
 H:{name:'fragmented-brush',pairs:['PR','RO','OP','ON','EC'],curvature:.25,width:3.3},
 I:{name:'chisel',pairs:['PR','RO','RT','PI','IE'],curvature:-.15,width:4.3}
});
const hash=s=>{let h=2166136261;for(const ch of s)h=Math.imul(h^ch.charCodeAt(0),16777619);return(h>>>0)/4294967296};
export function composeStyleWord(family,plan,{seed='V3',mode='restrained'}={}){
 if(family==='G')return composeLoopsWord(plan,{seed,mode});
 if(family==='F')return composeBroadNib(plan,{seed,mode});
 if(family==='D')return composeRectilinear(plan,{seed,mode});
 if(!RULES[family])throw new RangeError('Unknown family');
 if(!['none','restrained','expressive'].includes(mode))throw new RangeError('Unknown mode');
 const rule=RULES[family],letters=plan.letters.map(item=>({...item,variant:'plain',shapes:item.glyph.shapes})),shared=[],connectors=[];
 if(mode!=='none')for(let i=1;i<letters.length;i++){
  const a=letters[i-1],b=letters[i],pair=a.ch+b.ch;
  if(b.index!==a.index+1||!rule.pairs.includes(pair))continue;
  const chance=hash(seed+'|'+family+'|'+i);
  if(chance>(mode==='expressive'?.85:.48))continue;
  const start=a.x+65*a.scale,end=b.x+18*b.scale,span=end-start;
  if(span<2||span>75)continue;
  const high=rule.curvature*18+(chance-.5)*6;
  const d=family==='D'||family==='C'
   ?`M ${start.toFixed(2)} 56 L ${(start+span*.618).toFixed(2)} ${(56-high).toFixed(2)} L ${end.toFixed(2)} 56`
   :`M ${start.toFixed(2)} 56 C ${(start+span*.382).toFixed(2)} ${(56-high).toFixed(2)} ${(end-span*.382).toFixed(2)} ${(56+high*.45).toFixed(2)} ${end.toFixed(2)} 56`;
  shared.push({kind:'stroke',role:family==='H'?'secondary':'primary',width:rule.width,d,from:a.index,to:b.index,pair,grammar:rule.name});
  a.variant='send';b.variant='receive';
 }
 return {word:plan.word,letters,shared,connectors,mode,revision:GRAMMAR_REVISION};
}
