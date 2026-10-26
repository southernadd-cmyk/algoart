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

const SVG_NS='http://www.w3.org/2000/svg';
const fmt=n=>Number(n.toFixed(2));
function mapPoint(item,f,p) {
 const x=p.x*item.scale+f.italic*p.y,y=p.y;
 const rot=item.rotation*Math.PI/180,cs=Math.cos(rot),sn=Math.sin(rot);
 return {x:item.x+38+(x-38)*cs-(y-54)*sn,
  y:item.y+54+(x-38)*sn+(y-54)*cs};
}
function terminal(item,f,exit){
 // The longest authored non-hairline stroke, not a generic crossing point.
 const measured=item.glyph.shapes.filter(s=>s.kind!=='hairline'&&s.kind!=='fill').map(shape=>{
  const path=document.createElementNS(SVG_NS,'path');path.setAttribute('d',shape.d);
  return {path,length:path.getTotalLength()};
 }).filter(s=>s.length>20).sort((a,b)=>b.length-a.length);
 if(!measured.length)return null;
 const {path,length}=measured[0],at=exit?length:0;
 const pt=mapPoint(item,f,path.getPointAtLength(at));
 const prior=mapPoint(item,f,path.getPointAtLength(exit?Math.max(0,length-7):Math.min(length,7)));
 const vector=exit?{x:pt.x-prior.x,y:pt.y-prior.y}:{x:prior.x-pt.x,y:prior.y-pt.y};
 const norm=Math.hypot(vector.x,vector.y)||1;
 return {pt,tan:{x:vector.x/norm,y:vector.y/norm}};
}
export function exitContinuations(f,plan,{seed=plan.seed,enabled=true}={}){
 const layer=document.createElementNS(SVG_NS,'g');
 layer.setAttribute('data-role','v2-exit-continuations');
 if(!enabled||!['A','F','G'].includes(f.id))return layer;
 const cap=WORD_POLICIES[f.id].maxJoins;
 if(cap<1)return layer;
 const candidates=[];
 for(let i=1;i<plan.letters.length;i++){
  const prev=plan.letters[i-1],next=plan.letters[i];
  if(next.index!==prev.index+1||prev.ch==='Φ'||next.ch==='Φ')continue;
  const out=terminal(prev,f,true),into=terminal(next,f,false);
  if(!out||!into)continue;
  const dx=into.pt.x-out.pt.x,dy=into.pt.y-out.pt.y,distance=Math.hypot(dx,dy);
  if(distance<5||distance>46||Math.abs(dy)>29)continue;
  if(out.tan.x<.05||into.tan.x<-.60)continue;
  const directional=(dx*out.tan.x+dy*out.tan.y)/distance;
  if(directional<.1)continue;
  candidates.push({out,into,distance,score:distance+Math.abs(dy)*.6-
   5*directional+stableNoise(seed+'|exit|'+f.id+'|'+i)*2,index:i});
 }
 candidates.sort((a,b)=>a.score-b.score);
 for(const c of candidates.slice(0,cap)){
  const len=Math.min(18,c.distance*.48),out=c.out,into=c.into;
  const path=document.createElementNS(SVG_NS,'path');
  path.setAttribute('d','M '+fmt(out.pt.x)+' '+fmt(out.pt.y)+' C '+
   fmt(out.pt.x+out.tan.x*len)+' '+fmt(out.pt.y+out.tan.y*len)+' '+
   fmt(into.pt.x-into.tan.x*len)+' '+fmt(into.pt.y-into.tan.y*len)+' '+
   fmt(into.pt.x)+' '+fmt(into.pt.y));
  for(const [key,value]of Object.entries({fill:'none',stroke:'currentColor',
   'stroke-width':f.id==='F'?'1.6':'2.5','stroke-linecap':'round',
   'data-join':plan.letters[c.index-1].ch+plan.letters[c.index].ch,
   'data-exit-continuation':'true'}))path.setAttribute(key,value);
  layer.append(path);
 }
 return layer;
}
