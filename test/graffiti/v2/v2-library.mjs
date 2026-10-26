// First source-anchored V2 pilot. V1 remains the production baseline.
// Geometry is ORIGINAL reconstruction of visible construction rules, not traces.
// Round 2 retains the approved three glyphs and pilots seven further source-sheet-led glyphs.
// Five other families, including disputed source B, remain exact V1 geometry controls.
import {FAMILIES as ORIGINAL,getFamily as originalFamily,stableNoise,LETTERS} from '../family-library.mjs';
import {PHI_BY_FAMILY} from '../family-symbols.mjs';

export const V2_REVISION='pilot-sheets20-29-59-10-round2';
export const PILOT_EVIDENCE=Object.freeze({
  'D:H':Object.freeze({sheet:20,letters:'H',observation:'Sheet 20 H consists of two unevenly pitched bold uprights crossed by a single decisive bar extending slightly past the second stem; it has a sloping, handwritten horizontal, not a symmetric stencil crossbar.',
   change:'Re-author both uprights and the overshooting crossbar as three discrete firm marker passes.'}),
  'D:S':Object.freeze({sheet:20,letters:'S',observation:'Sheet 20 S is composed of short angular box-like turns rather than a smooth curve; the upper arm is flatter and the lower exit finishes abruptly and farther to the right.',
   change:'Replace the generic rounded-square run with an asymmetric kinked S and deliberate short exit.'}),
  'E:A':Object.freeze({sheet:29,letters:'A',observation:'Sheet 29 A is made from a long descending wedge and an opposing returning blade, with a hooked arched head and spacious lower counter; the top join is more informative than repeated midline marks.',
   change:'Construct an asymmetric peaked head connecting two Gothic blades, with a single fine counter mark.'}),
  'E:N':Object.freeze({sheet:29,letters:'N',observation:'Sheet 29 N shows grouped black vertical minims, but a high angled shoulder and one directional cross stroke distinguish its N from adjacent I and M forms.',
   change:'Link the upper ends by a forward descending black shoulder rather than leaving only separate verticals.'}),
  'F:A':Object.freeze({sheet:59,letters:'A',observation:'Sheet 59 red A has a light curling approach from the left feeding into a broad sloped downstroke, a thin returning motion and a smaller crossing gesture; the mark has calligraphic rhythm instead of a triangular capital outline.',
   change:'Re-author the approach loop, broad rising main pass and thin return as separate visible nib gestures.'}),
  'F:S':Object.freeze({sheet:59,letters:'S',observation:'Sheet 59 red S is a fluid two-bowl brush turn: the top entry rises from left to right and folds back, while the lower bowl cuts across on a single long exit ribbon.',
   change:'Draw a continuous main S brush gesture with one thin entry and a sharp outward finishing run.'}),
  'I:M':Object.freeze({sheet:10,letters:'M',observation:'Sheet 10 cyan M uses two narrow upright strokes with compressed sharp mid-cuts and a small upper head stroke, rather than a broad three-arch letter; the terminal remains open.',
   change:'Rebuild the M as two chisel trunks with a joined narrow middle V and offset terminal head.'}),
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
  H:Object.freeze([
   path('stroke','M 9 -2 L 8 110'),
   path('stroke','M 83 4 L 87 110'),
   path('stroke','M 2 59 L 93 51 L 103 57')
  ]),
  S:Object.freeze([
   path('stroke','M 86 17 L 65 4 L 25 4 L 5 26 L 7 43 L 30 52 L 69 57 L 84 74 L 82 88 L 58 108 L 13 103 L -3 90'),
   path('stroke','M 13 29 L 42 27'),
   path('hairline','M 60 105 L 95 110')
  ]),
  E:Object.freeze([
   path('stroke','M 87 4 L 7 5 L 4 106 L 96 112'),
   path('stroke','M 5 53 L 69 48 L 80 54'),
   path('stroke','M 84 7 L 87 -4'),
   path('hairline','M 84 97 L 99 109')
  ])
 }),
 E:Object.freeze({
  A:Object.freeze([
   path('fill','M 9 108 L 8 18 Q 20 -3 40 10 L 30 99 L 19 119 Z'),
   path('fill','M 41 34 Q 56 3 71 5 L 83 24 L 73 115 L 55 101 L 67 36 L 57 29 Z'),
   path('fill','M 19 24 Q 39 -12 69 14 L 59 28 Q 40 9 29 45 Z'),
   path('hairline','M 31 72 Q 49 61 66 73')
  ]),
  N:Object.freeze([
   path('fill','M 8 110 L 9 13 L 27 -5 L 42 15 L 30 111 L 17 118 Z'),
   path('fill','M 71 108 L 73 14 L 90 -5 L 103 13 L 91 111 L 78 118 Z'),
   path('fill','M 28 28 Q 47 0 61 28 L 82 79 L 76 104 L 63 87 L 45 41 L 31 47 Z'),
   path('hairline','M 26 90 Q 45 78 66 97')
  ]),
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
 }),
 F:Object.freeze({
  A:Object.freeze([
   path('hairline','M -11 66 Q 8 35 33 18 C 54 3 64 15 59 32'),
   path('stroke','M 10 111 C 20 83 30 35 48 2 Q 55 -9 61 15 L 71 106'),
   path('hairline','M 7 73 C 30 52 56 58 84 43'),
   path('stroke','M 63 92 Q 77 121 96 102')
  ]),
  S:Object.freeze([
   path('hairline','M 83 11 C 57 -6 25 -5 10 20'),
   path('stroke','M 77 19 C 49 -4 12 14 17 37 C 21 54 61 52 74 72 C 92 104 43 120 11 102'),
   path('hairline','M 14 103 Q -4 98 -5 84 L 8 80'),
   path('stroke','M 55 117 Q 77 121 94 100')
  ])
 }),
 I:Object.freeze({
  M:Object.freeze([
   path('stroke','M 15 116 L 17 2 L 37 56'),
   path('stroke','M 38 55 L 52 19 L 77 116'),
   path('hairline','M 53 20 L 75 7 L 88 20'),
   path('stroke','M 17 23 L 28 1')
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
