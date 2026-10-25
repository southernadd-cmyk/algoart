import {LETTERS} from './families/parse.mjs';
import {PHI_BY_FAMILY} from './family-symbols.mjs';
import {interlocked,skeletal,wedges} from './families/A-C.mjs';
import {block,gothic,calligraphy} from './families/D-F.mjs';
import {orbitals,fragments} from './families/G-H.mjs';
import {airy,sweeps} from './families/I-J.mjs';

export const PHASE_D_VERSION='draft-1';
export const FAMILIES=Object.freeze([interlocked,skeletal,wedges,block,gothic,calligraphy,orbitals,fragments,airy,sweeps]);
export const BY_ID=Object.freeze(Object.fromEntries(FAMILIES.map(f=>[f.id,f])));
export {LETTERS};
export function getFamily(id){
 const f=BY_ID[id];if(!f)throw new RangeError('Unknown alphabet family '+id);return f;
}
export function getGlyph(id,letter){
 const f=getFamily(id),ch=String(letter).toUpperCase(),g=ch==='Φ'?PHI_BY_FAMILY[id]:f.glyphs[ch];
 if(!g)throw new RangeError('No authored letter '+letter+' in '+id);
 return g;
}
export function stableNoise(value){
 let n=2166136261;for(const ch of String(value))n=Math.imul(n^ch.charCodeAt(0),16777619);
 n+=0x6d2b79f5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);
 return ((t^t>>>14)>>>0)/4294967296;
}
const WIDE=new Set(['M','W']),NARROW=new Set(['I','J']);
export const TOWER_SIGNATURES=Object.freeze(['PHI','φ','PROPORTION PIECE']);
const LONG_WORD_TRACKING=Object.freeze({A:6,B:13,F:5,G:8,J:11});
export function composeWord(id,text,{seed='PP-ALPHABETS-01',variation=.04}={}){
 const f=getFamily(id);
 const word=String(text).normalize('NFKC').toUpperCase().replace(/[^A-ZΦ ]/g,'').slice(0,65);
 if(!word.trim())throw new RangeError('Use letters A–Z');
 if(!Number.isFinite(variation)||variation<0||variation>.12)throw new RangeError('Invalid variation');
 // A fast interlocked four-letter tag is not spaced like a ten-letter title.
 // Only the overlapping styles expand their tracking for longer runs.
 const runLengths=[];for(let j=0;j<word.length;){
  if(word[j]===' '){runLengths[j]=0;j++;continue}
  let k=j;while(k<word.length&&word[k]!==' ')k++;
  for(let p=j;p<k;p++)runLengths[p]=k-j;
  j=k;
 }
 const letters=[];let cursor=0;
 for(let i=0;i<word.length;i++){
  const ch=word[i];
  if(ch===' '){cursor+=f.spacing*.56;continue}
  const g=getGlyph(id,ch),wide=WIDE.has(ch)?21:NARROW.has(ch)?-19:0;
  const shift=variation? (stableNoise(seed+'|'+id+'|'+i+'|y')-.5)*18*variation:0;
  const rotation=variation? (stableNoise(seed+'|'+id+'|'+i+'|r')-.5)*10*variation:0;
  const scale=1+(stableNoise(seed+'|'+id+'|'+i+'|x')-.5)*.1*variation;
  letters.push(Object.freeze({ch,index:i,x:cursor,y:shift,rotation,scale,glyph:g}));
  const extra=(LONG_WORD_TRACKING[id]||0)*Math.min(1,Math.max(0,(runLengths[i]-5)/4));
  cursor+=f.spacing+wide-f.overlap+extra;
 }
 return Object.freeze({id,word,seed,variation,letters:Object.freeze(letters),
  width:Math.max(100,cursor+43),height:156});
}
export function auditFamilies(){
 return FAMILIES.map(f=>({
  id:f.id,referenceSheet:f.primary,count:Object.keys(f.glyphs).length,
  paths:Object.values(f.glyphs).reduce((n,g)=>n+g.shapes.length,0),
  uniqueLetters:new Set(Object.values(f.glyphs).map(g=>g.shapes.map(s=>s.d).join('|'))).size,
  geometryFingerprint:Object.values(f.glyphs).map(g=>g.shapes.map(s=>s.d).join('|')).join('~')
 }));
}
