// Broad-nib V3: continuous calligraphic clusters replace recipient skeleton strokes.
// V2 stays immutable; each composed letter carries its own shape list.
export const BROADNIB_REVISION='nib-clusters-03';
const families=new Set(['PRO','ROP','OPO','POR','ORT','RTI','TIO','ION','PIE','IEC','ECE']);
const pairs=new Set(['PR','RO','OP','PO','OR','RT','TI','IO','ON','PI','IE','EC','CE']);
function rand(seed){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296}
function pathFor(items,seed,mode){
 const [a,b,c]=items;
 const r=rand(seed+'|'+a.index+'|'+a.ch+b.ch+c.ch);
 const start=a.x+69*a.scale,mid=b.x+42*b.scale,end=c.x+13*c.scale;
 const shoulder=35+r*11,belly=71+r*11;
 const strength=mode==='expressive'?1.18:1;
 // Two joined cubic gestures form ONE continuous pen movement across three glyphs.
 return `M ${start.toFixed(2)} 43 C ${(start+17*strength).toFixed(2)} ${shoulder.toFixed(2)} ${(mid-32).toFixed(2)} ${(shoulder-6).toFixed(2)} ${mid.toFixed(2)} 52 C ${(mid+26*strength).toFixed(2)} ${belly.toFixed(2)} ${(end-23).toFixed(2)} ${(shoulder+4).toFixed(2)} ${end.toFixed(2)} 50`;
}
export function composeBroadNib(plan,{seed='V3',mode='restrained'}={}){
 if(!['none','restrained','expressive'].includes(mode))throw new RangeError('Unknown nib mode');
 const letters=plan.letters.map(l=>({...l,variant:'plain',shapes:[...l.glyph.shapes]})),shared=[];
 if(mode==='none')return {word:plan.word,letters,shared,connectors:[],mode,revision:BROADNIB_REVISION};
 const occupied=new Set();
 for(let i=0;i<letters.length-2;i++){
  const trio=letters.slice(i,i+3);
  if(trio[1].index!==trio[0].index+1||trio[2].index!==trio[1].index+1)continue;
  const sequence=trio.map(l=>l.ch).join('');
  if(!families.has(sequence)||trio.some(l=>occupied.has(l.index)))continue;
  const r=rand(seed+'|cluster|'+sequence+'|'+i);
  if(r>(mode==='expressive'?.94:.79))continue;
  const [a,b,c]=trio;
  shared.push({kind:'stroke',role:'primary',width:4.7,subtype:'curve',d:pathFor(trio,seed,mode),members:trio.map(l=>l.index),sequence,tool:'angled-nib',structural:true});
  // The connecting curve is a replacement for the first structural pen passes
  // of the receiver glyphs, not an overlay on top of complete V2 forms.
  for(const l of [b,c]){
   // Retain the bowl/stem: V2's first stroke is often the entire glyph.
   // Only remove an independently drawn thin flourish, when present.
   const removable=l.shapes.findIndex(shape=>shape.kind==='hairline');
   if(removable>=0)l.shapes.splice(removable,1);
   l.variant='shared-nib-'+sequence;
  }
  a.variant='nib-lead-'+sequence;
  trio.forEach(l=>occupied.add(l.index));
  i+=2;
 }
 // Short connected pairs fill gaps not covered by the structural clusters.
 for(let i=1;i<letters.length;i++){
  const a=letters[i-1],b=letters[i],pair=a.ch+b.ch;
  if(b.index!==a.index+1||occupied.has(a.index)||occupied.has(b.index)||!pairs.has(pair))continue;
  if(rand(seed+'|pair|'+i)>(mode==='expressive'?.82:.48))continue;
  const x=a.x+60*a.scale,y=b.x+14*b.scale;
  if(y-x<3||y-x>75)continue;
  const d=`M ${x.toFixed(2)} 57 C ${(x+13).toFixed(2)} 43 ${(y-13).toFixed(2)} 65 ${y.toFixed(2)} 50`;
  shared.push({kind:'stroke',role:'secondary',width:3.1,subtype:'crossbar',d,from:a.index,to:b.index,pair,tool:'angled-nib',structural:true});
  a.variant='nib-sender';b.variant='nib-receiver';
 }
 return {word:plan.word,letters,shared,connectors:[],mode,revision:BROADNIB_REVISION};
}
