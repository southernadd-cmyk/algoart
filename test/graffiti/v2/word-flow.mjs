// Word-level V2 studies. Geometry choices derive from documented source notes:
// KENO: fluent, legible names without extra flourishes; Nargue/GROG: a tag is
// one designed word rather than a line of individually decorated characters.
// Source sheets: 41 (A crossed marker), 20 (D block), 29 (E Gothic),
// 8 (G orbital), 10 (I chisel). These are hypotheses, not writer copies.
import {stableNoise} from '../family-library.mjs';
export const WORD_FLOW_REVISION='source-led-word-flow-01';
export const WORD_POLICIES=Object.freeze({
 A:Object.freeze({ornamentsPerWord:1,maxJoins:1,trackingAdjustment:4,why:'Sheet 41 has strong crossings, but whole-tag evidence favours one dominant accent rather than a flourish on each letter.'}),
 B:Object.freeze({ornamentsPerWord:1,maxJoins:1,trackingAdjustment:1,why:'Sheet 7 is a thin handstyle: selective cross strokes rather than dense synthetic connections.'}),
 C:Object.freeze({ornamentsPerWord:0,maxJoins:0,trackingAdjustment:1,why:'Sheet 13 uses independent cut wedges, not artificial connecting threads.'}),
 D:Object.freeze({ornamentsPerWord:0,maxJoins:0,trackingAdjustment:2,why:'Sheet 20 has hard-ended block construction; avoid S/H collisions, retain decisive shelves.'}),
 E:Object.freeze({ornamentsPerWord:0,maxJoins:0,trackingAdjustment:1,why:'Sheet 29 uses high filled shoulder joins; middle wavy hairlines have no support in the research ledger.'}),
 F:Object.freeze({ornamentsPerWord:2,maxJoins:2,trackingAdjustment:1,why:'Sheet 59 includes light approach strokes and selective brush exits, not a repeated decorative line on every glyph.'}),
 G:Object.freeze({ornamentsPerWord:1,maxJoins:1,trackingAdjustment:3,why:'Sheet 8 carries one dominant looping movement per complete tag; preserve necessary inner counter loops.'}),
 H:Object.freeze({ornamentsPerWord:0,maxJoins:0,trackingAdjustment:3,why:'Sheet 30 relies on purposefully separated brush fragments, not fake joins.'}),
 I:Object.freeze({ornamentsPerWord:1,maxJoins:0,trackingAdjustment:2,why:'Sheet 10 has a narrow chisel trunk with selected head flicks.'})
});
const enforce=(p)=>Number.isInteger(p?.ornamentsPerWord)&&p.maxJoins>=0;
if(!Object.values(WORD_POLICIES).every(enforce))throw Error('Incomplete word policy');
function chosenAccentIndices(f,plan) {
 const candidates=plan.letters.filter(l=>l.glyph.shapes.some(s=>s.kind==='hairline'));
 const cap=Math.min(WORD_POLICIES[f.id].ornamentsPerWord,candidates.length);
 return new Set([...candidates].sort((a,b)=>{
  // Prefer word-boundary accents, deterministic for equal priority.
  const score=x=>(x.index===0?1:0)+(x.index===plan.word.length-1?.9:0)+
   .2*stableNoise(plan.seed+'|accent|'+f.id+'|'+x.index);
  return score(b)-score(a);
 }).slice(0,cap).map(l=>l.index));
}
export function wordPlan(f,original){
 const p=WORD_POLICIES[f.id],letters=[];
 let offset=0;
 for(let i=0;i<original.letters.length;i++){
  const current=original.letters[i],previous=original.letters[i-1];
  if(previous){
   // Never join across spaces. The indices are positions in the word.
   if(current.index===previous.index+1){
    offset+=p.trackingAdjustment;
    if(f.id==='D'&&previous.ch==='S'&&current.ch==='H')offset+=19;
    if(f.id==='G'&&previous.ch==='S'&&current.ch==='H')offset+=5;
    if(f.id==='A'&&'MW'.includes(previous.ch)&&'MI'.includes(current.ch))offset+=4;
   }
  }
  letters.push(Object.freeze({...current,x:current.x+offset}));
 }
 const out=Object.freeze({...original,letters:Object.freeze(letters),
  width:original.width+offset,wordFlowRevision:WORD_FLOW_REVISION});
 const accented=chosenAccentIndices(f,out);
 return Object.freeze({...out,accented});
}
export function showGesture(f,item,s,plan){
 if(s.kind!=='hairline')return true;
 if(f.id==='E')return false; // Disallow all unsupported middle hairlines in Gothic words.
 return plan.accented.has(item.index);
}
export function limitJoins(f,layer,plan){
 const max=WORD_POLICIES[f.id].maxJoins;
 const paths=[...layer.querySelectorAll('path[data-join]')];
 // Ranked by proximity to a centre or end of the word, not random frequency.
 const ranked=[...paths].sort((a,b)=>{
  const score=x=>{const index=Number(x.getAttribute('data-letter-index'));
   return Math.abs(index-(plan.word.length-1)*.5);};
  return score(a)-score(b);
 });
 const keep=new Set(ranked.slice(0,max));
 for(const path of paths)if(!keep.has(path))path.remove();
 layer.setAttribute('data-join-cap',String(max));
 return layer;
}
