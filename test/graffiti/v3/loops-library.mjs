// V3 experimental interlocking Loops: variant strokes and neighbour-aware bridges.
// Unchanged V2 structural geometry remains the fallback for every capital.
import {getGlyph} from '../v2/v2-library.mjs';
export const LOOPS_REVISION='interlocking-alpha-03';
export const LOOP_CLASSES=Object.freeze({strong:'OPRCSUG',bridge:'TINMHL',terminal:'EFKXZ'});
const subset='PROTINEC';
const pairScores=Object.freeze({PR:5,RO:5,OP:4,OO:5,OR:4,ON:3,PI:3,IE:2,EC:3,CE:3,RT:2,TI:2,IO:2,PO:5,OT:3,TO:2,NC:2,PE:3});
const shape=(d)=>Object.freeze({kind:'stroke',role:'structure',d});
const variants=Object.freeze({
 P:Object.freeze({entry:shape('M 9 106 Q -6 53 14 21'),exit:shape('M 49 54 Q 76 75 87 48')}),
 R:Object.freeze({entry:shape('M 10 98 Q -5 51 18 29'),exit:shape('M 67 77 Q 93 99 95 58')}),
 O:Object.freeze({entry:shape('M 12 73 C -7 29 21 -8 54 12'),exit:shape('M 71 64 Q 85 38 91 51')}),
 T:Object.freeze({entry:shape('M 12 14 Q -3 34 15 48'),exit:shape('M 62 32 Q 82 44 91 50')}),
 I:Object.freeze({entry:shape('M 11 30 Q -4 52 17 65'),exit:shape('M 66 42 Q 80 31 90 52')}),
 N:Object.freeze({entry:shape('M 13 68 Q -4 48 16 29'),exit:shape('M 73 66 Q 85 41 91 52')}),
 E:Object.freeze({entry:shape('M 12 55 Q 1 35 15 31'),exit:shape('M 63 79 Q 84 67 91 55')}),
 C:Object.freeze({entry:shape('M 16 59 Q -7 45 18 27'),exit:shape('M 70 76 Q 85 65 91 52')})
});
export const LOOP_VARIANTS=Object.freeze(Object.fromEntries([...subset].map(ch=>[ch,Object.freeze(['plain','receive','send','through'])])));
const coordinate=(item,p)=>({x:item.x+p.x*item.scale+.0,y:item.y+p.y});
const exits=Object.freeze({P:{x:74,y:54},R:{x:78,y:57},O:{x:75,y:58},T:{x:75,y:56},I:{x:72,y:54},N:{x:77,y:55},E:{x:76,y:59},C:{x:76,y:59}});
const entries=Object.freeze({P:{x:12,y:57},R:{x:12,y:55},O:{x:12,y:57},T:{x:11,y:55},I:{x:11,y:55},N:{x:12,y:55},E:{x:11,y:59},C:{x:12,y:56}});
function jitter(seed,key){let h=2166136261;for(const c of seed+'|'+key)h=Math.imul(h^c.charCodeAt(0),16777619);return ((h>>>0)/4294967296-.5)*2;}
export function composeLoopsWord(plan,{seed='V3-STUDY-01',mode='restrained'}={}){
 if(!['none','restrained','expressive'].includes(mode))throw new RangeError('Invalid Loops mode');
 const letters=plan.letters.map(item=>({...item,variant:'plain',shapes:getGlyph('G',item.ch).shapes}));
 const connectors=[];const taken=new Set();
 const candidates=[];
 for(let i=1;i<letters.length;i++){
  const a=letters[i-1],b=letters[i];
  if(b.index!==a.index+1||!variants[a.ch]||!variants[b.ch])continue;
  const score=(pairScores[a.ch+b.ch]||1)+jitter(seed,a.index+':'+b.index)*.35;
  candidates.push({i,score});
 }
 candidates.sort((a,b)=>b.score-a.score);
 const max=mode==='none'?0:mode==='expressive'?Math.max(1,Math.ceil(candidates.length*.55)):Math.max(1,Math.ceil(candidates.length*.32));
 for(const {i,score} of candidates){
  if(connectors.length>=max)break;
  const a=letters[i-1],b=letters[i];
  if(taken.has(a.index)||taken.has(b.index)||score<1.4)continue;
  const start=coordinate(a,exits[a.ch]),end=coordinate(b,entries[b.ch]);
  const distance=Math.hypot(end.x-start.x,end.y-start.y);
  // Never bridge over letter counters or reach across unusually large gaps.
  if(end.x<=start.x+1||distance>57)continue;
  const rise=(mode==='expressive'?15:9)*(1+.16*jitter(seed,i));
  const span=end.x-start.x,phi=(1+Math.sqrt(5))/2;
  const d=`M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${(start.x+span/phi).toFixed(2)} ${(start.y-rise).toFixed(2)} ${(end.x-span/(phi*phi)).toFixed(2)} ${(end.y-rise*.7).toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  connectors.push({kind:'stroke',role:'secondary',width:mode==='expressive'?4.5:3.3,d,from:a.index,to:b.index,pair:a.ch+b.ch});
  taken.add(a.index);taken.add(b.index);
  a.variant='send';b.variant='receive';
 }
 // Shared structural passes replace selected V2 main strokes in known sequences.
 // The connecting curve starts inside the first glyph, traverses the intervening
 // letter's bowl and finishes inside the third; it is not an independent ornament.
 const shared=[];
 if(mode!=='none'){
  const patterns=['PRO','ORT','PIE','ECE','ROP','OPO','POR','RTI','TIO','ION','CEC','O RT'.replace(' ','')];
  for(let i=0;i<letters.length-2;i++){
   const trio=letters.slice(i,i+3);
   if(trio[1].index!==trio[0].index+1||trio[2].index!==trio[1].index+1)continue;
   const sequence=trio.map(x=>x.ch).join('');
   if(!patterns.includes(sequence))continue;
   const [a,b,c]=trio;
   const x0=a.x+54,x1=b.x+42,x2=c.x+38;
   const wiggle=jitter(seed,sequence+'|'+i)*10;
   const stretch=mode==='expressive'&&jitter(seed,'stretch|'+i)>.1?1.22:.9;
   const centreY=35+jitter(seed,'centre|'+i)*9;
   const phi=(1+Math.sqrt(5))/2;
   const d=`M ${x0.toFixed(2)} 38 C ${(x0+20*stretch).toFixed(2)} ${(8+wiggle).toFixed(2)} ${(x1-34).toFixed(2)} ${(12+wiggle).toFixed(2)} ${x1.toFixed(2)} ${centreY.toFixed(2)} C ${(x1+28*stretch).toFixed(2)} ${(82+wiggle).toFixed(2)} ${(x2-25/phi).toFixed(2)} ${(12+wiggle).toFixed(2)} ${x2.toFixed(2)} 45`;
   shared.push({kind:'stroke',role:'primary',width:mode==='expressive'?7.2:5.5,d,sequence,
    members:trio.map(x=>x.index),sharedStructure:true});
   // This stroke is the structure formerly supplied by part of the individual
   // glyphs, not a visually superimposed line. Retain the rest of each glyph.
   for(const item of [b,c]){
    item.shapes=item.shapes.filter((shape,index)=>index!==0);
    item.variant='shared-'+sequence;
   }
   // Avoid drawing an independent connector over the shared stroke.
   for(let k=connectors.length-1;k>=0;k--)if(connectors[k].from>=a.index&&connectors[k].to<=c.index)connectors.splice(k,1);
   i+=2;
  }
 }
 // Extend a selected gesture by one adjacent compatible glyph. The extended
 // pass follows the same curve rather than placing an independent flourish.
 if(mode==='expressive')for(const pass of shared){
  const end=letters.find(x=>x.index===pass.members.at(-1));
  const next=letters.find(x=>x.index===end.index+1);
  if(!next||!variants[next.ch]||pass.members.includes(next.index)||jitter(seed,'extension|'+end.index)<-.35)continue;
  const ex=next.x+38,ey=45+jitter(seed,'turn|'+next.index)*9;
  pass.d+=` Q ${(ex-24).toFixed(2)} ${(ey-39).toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  pass.members.push(next.index);pass.sequence+=next.ch;
  next.shapes=next.shapes.filter((_,i)=>i!==0);next.variant='extended-'+pass.sequence;
 }
 return {word:plan.word,letters,connectors,shared,mode,revision:LOOPS_REVISION};
}
