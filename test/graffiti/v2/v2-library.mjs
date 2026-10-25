// First source-anchored V2 pilot. V1 remains the production baseline.
// Geometry is ORIGINAL reconstruction of visible construction rules, not traces.
// Only three glyphs change: D:E from archive sheet 20 and E:H/M from sheet 29.
// Seven other families, including disputed source B, are exact V1 controls.
import {FAMILIES as ORIGINAL,getFamily as originalFamily,stableNoise,LETTERS} from '../family-library.mjs';
import {PHI_BY_FAMILY} from '../family-symbols.mjs';

export const V2_REVISION='pilot-sheets20-29-a';
export const PILOT_EVIDENCE=Object.freeze({
 'D:E':Object.freeze({sheet:20,letters:'E',observation:'The photographed E has a tall vertical, a comparatively long upper shelf, staggered middle shelf and an overshooting lower shelf; the arm ends are not a mathematically even stencil.',
   change:'Re-author the E path with unequal three shelves and a hand-pulled overshoot. No random wobble.'}),
 'E:H':Object.freeze({sheet:29,letters:'H',observation:'The H is two tall black stems joined with a high shoulder crossing from the left head toward the right; a lower directional return makes the crossbar distinct.',
   change:'Give H a high connecting flag and a shorter low rising return rather than an unsupported mid-body wave.'}),
 'E:M':Object.freeze({sheet:29,letters:'M',observation:'The M is a single clustered Gothic silhouette: three downward blades grouped by pointed upper shoulder arcs; bare disconnected minims do not read as M.',
   change:'Rebuild the three tapering blades with two explicit top shoulder bridges.'})
});
function path(kind,d){return Object.freeze({kind,d})}
const changes=Object.freeze({
 D:Object.freeze({
  E:Object.freeze([
   path('stroke','M 87 4 L 7 5 L 4 106 L 96 112'),
   path('stroke','M 5 53 L 69 48 L 80 54'),
   path('stroke','M 84 7 L 87 -4'),
   path('hairline','M 84 97 L 99 109')
  ])
 }),
 E:Object.freeze({
  H:Object.freeze([
   path('fill','M 8 109 L 7 12 L 26 -3 L 40 13 L 29 105 L 17 116 Z'),
   path('fill','M 65 108 L 65 11 L 81 -4 L 97 14 L 84 108 L 71 118 Z'),
   path('fill','M 26 27 Q 43 3 62 22 L 79 12 L 77 34 Q 51 25 33 47 Z'),
   path('hairline','M 29 77 Q 42 66 64 73')
  ]),
  M:Object.freeze([
   path('fill','M 5 107 L 7 15 L 25 -4 L 39 13 L 29 108 L 16 118 Z'),
   path('fill','M 41 108 L 43 15 L 58 -3 L 73 14 L 65 108 L 51 117 Z'),
   path('fill','M 80 108 L 82 14 L 99 -3 L 112 14 L 103 110 L 89 119 Z'),
   path('fill','M 24 29 Q 37 2 56 23 L 65 23 Q 81 0 99 22 L 92 34 Q 76 20 65 43 L 56 41 Q 41 18 30 47 Z')
  ])
 })
});
const newFamily=(f)=>{
 if(!changes[f.id])return f;
 const glyphs=Object.create(null);
 for(const ch of LETTERS){
  const v=changes[f.id][ch];
  glyphs[ch]=v?Object.freeze({letter:ch,shapes:v}):f.glyphs[ch];
 }
 return Object.freeze({...f,name:f.name+' (sheet-led V2 pilot)',glyphs:Object.freeze(glyphs)});
};
export const FAMILIES=Object.freeze(ORIGINAL.map(newFamily));
export const BY_ID=Object.freeze(Object.fromEntries(FAMILIES.map(f=>[f.id,f])));
export {LETTERS};
export function getFamily(id){const f=BY_ID[id];if(!f)throw new RangeError('Unknown V2 alphabet family '+id);return f}
export function getGlyph(id,letter){
 const ch=String(letter).toUpperCase();
 const glyph=ch==='Φ'?PHI_BY_FAMILY[id]:getFamily(id).glyphs[ch];
 if(!glyph)throw new RangeError('Unknown glyph '+letter+' in '+id);
 return glyph;
}
const WIDE=new Set(['M','W']),NARROW=new Set(['I','J']);
const LONG_WORD_TRACKING=Object.freeze({A:6,B:13,F:5,G:8});
export function composeWord(id,text,{seed='PP-ALPHABETS-01',variation=.04}={}){
 const f=getFamily(id),word=String(text).normalize('NFKC').toUpperCase().replace(/[^A-ZΦ ]/g,'').slice(0,65);
 if(!word.trim())throw new RangeError('Use letters A–Z');
 if(!Number.isFinite(variation)||variation<0||variation>.12)throw new RangeError('Invalid variation');
 const runLengths=[];
 for(let j=0;j<word.length;){
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
  const shift=variation?(stableNoise(seed+'|'+id+'|'+i+'|y')-.5)*18*variation:0;
  const rotation=variation?(stableNoise(seed+'|'+id+'|'+i+'|r')-.5)*10*variation:0;
  const scale=1+(stableNoise(seed+'|'+id+'|'+i+'|x')-.5)*.1*variation;
  letters.push(Object.freeze({ch,index:i,x:cursor,y:shift,rotation,scale,glyph:g}));
  const extra=(LONG_WORD_TRACKING[id]||0)*Math.min(1,Math.max(0,(runLengths[i]-5)/4));
  cursor+=f.spacing+wide-f.overlap+extra;
 }
 return Object.freeze({id,word,seed,variation,letters:Object.freeze(letters),
   width:Math.max(100,cursor+43),height:156});
}
export function pilotDiff(){
 return FAMILIES.flatMap(f=>LETTERS.split('').filter(ch=>
  f.glyphs[ch].shapes.map(s=>s.kind+':'+s.d).join('|')!==
  originalFamily(f.id).glyphs[ch].shapes.map(s=>s.kind+':'+s.d).join('|')).map(ch=>f.id+':'+ch));
}
