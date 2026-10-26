// First source-anchored V2 pilot. V1 remains the production baseline.
// Geometry is ORIGINAL reconstruction of visible construction rules, not traces.
// Round 2 retains the approved three glyphs and pilots seven further source-sheet-led glyphs.
// Five other families, including disputed source B, remain exact V1 geometry controls.
import {FAMILIES as ORIGINAL,getFamily as originalFamily,stableNoise,LETTERS} from '../family-library.mjs';
import {PHI_BY_FAMILY} from '../family-symbols.mjs';

export const V2_REVISION='all-nine-az-source-review-02';
export const INSTRUMENT_REVISIONS=Object.freeze({B:'Sheet 7 light crossed line; V1 fat marker 12.5 was incompatible with source. V2 uses 6.1-weight crossed hand.'});
export const PILOT_EVIDENCE=Object.freeze({
  'A:O':Object.freeze({sheet:41,letters:'O',observation:'The source O is not a plain circular loop: sharp angular returns cut a tall opening while the crossed stroke punctures the left side and extends beyond the perimeter.',change:'Replace a generic enclosing oval with angular top, inward right turn and one independent, clearly directional crossing pass.'}),
  'A:M':Object.freeze({sheet:41,letters:'M',observation:'The source M is formed by steep converging diagonals, one solid lower-left foot and a large acute open counter; its dominant long crossover is part of the skeleton.',change:'Emphasise three legible diagonal stems and keep only one structural crossing stroke, instead of repeated short flourishes.'}),
  'B:A':Object.freeze({sheet:7,letters:'A',observation:'Sheet 7 A is skeletal, airy and open: a loose sloped left entry, intersecting upright and a thin sweep passing through the upper counter. It is not a thick arrow-marker block.',change:'Pilot a separately authored fine-line A with light crossed upper strokes, retaining the existing heavy style in V1 for comparison.'}),
  'B:O':Object.freeze({sheet:7,letters:'O',observation:'Sheet 7 O uses an irregular circled outline crossed by a nearly horizontal centre bar that extends beyond the ring; the counter remains visibly open.',change:'Pilot the thin ring and long pierced centre rather than a heavy oval with a solid arrow tip.'}),
  'C:A':Object.freeze({sheet:13,letters:'A',observation:'Sheet 13 A combines an angular cut stem, a separated sloping blade and a short open high counter; the shape is asymmetric and made of decisive triangular wedges.',change:'Rebuild A with separate polygonal blade pieces and a real triangular negative-space notch.'}),
  'C:O':Object.freeze({sheet:13,letters:'O',observation:'Sheet 13 O is a thick ring of irregular angular wedge segments enclosing a sharp eccentric hole rather than a round geometric font counter.',change:'Re-author a deliberately off-centre polygonal O with a cut-out inner counter and angular outer turns.'}),
  'G:O':Object.freeze({sheet:8,letters:'O',observation:'Sheet 8 O is made from a broad repeated orbit with one smaller inner eye and a return across the interior, not equal-amplitude wobble at each contour point.',change:'Retain one confident outer orbit, a smaller inner eye, and a single crossing return.'}),
  'G:S':Object.freeze({sheet:8,letters:'S',observation:'Sheet 8 S is drawn with an energetic long looping upper turn that descends into a dominant bottom sweep; inner curls sit within the larger directional movement.',change:'Keep a long committed S path with one inner counter-echo, not several independent wobbling rings.'}),
  'H:A':Object.freeze({sheet:30,letters:'A',observation:'Sheet 30 A is clearly assembled from separate red slashed fragments with a high triangular empty counter, a long sharp left blade and a detached crossband.',change:'Use three individually outlined angular paint masses while preserving the visible central triangular white gap.'}),
  'H:S':Object.freeze({sheet:30,letters:'S',observation:'Sheet 30 S comprises detached red wedges at the top and middle, with a long lower ribbon curling back; the deliberate gaps define the letter rather than texture noise.',change:'Rebuild the upper two wedge groups and lower angled sweep as separated filled marks with purposeful paper gaps.'}),
  'I:A':Object.freeze({sheet:10,letters:'A',observation:'Sheet 10 cyan A is narrow and upright, with a short offset cap, slim downward chisel trunk and very open counter; the top is not a broad sloping triangle.',change:'Give A an offset sharp head, slender downstroke and short return bar while keeping the interior open.'}),
  'I:O':Object.freeze({sheet:10,letters:'O',observation:'Sheet 10 O is a thin vertically extended single-stroke teardrop with one tipped upper point and a small lighter overlap, unlike a normal wide loop.',change:'Build a narrow elongated downward and upward chisel circuit with a pointed upper terminal.'}),
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
 A:Object.freeze({
  O:Object.freeze([
   path('heavy','M 7 74 L 18 19 L 53 -4 L 83 15 L 76 83 L 48 112 L 17 92 L 7 74'),
   path('stroke','M -7 72 L 56 35 L 91 48'),
   path('hairline','M 18 24 L 42 5')
  ]),
  M:Object.freeze([
   path('heavy','M -3 108 L 19 6 L 42 69 L 64 4 L 85 110'),
   path('stroke','M -5 79 L 74 33'),
   path('hairline','M 61 8 L 79 22')
  ])
 }),
 B:Object.freeze({
  A:Object.freeze([
   path('stroke','M -5 108 Q 24 76 34 5 L 75 108'),
   path('stroke','M -8 70 L 67 33 L 87 53'),
   path('hairline','M 17 10 Q 34 -4 51 13')
  ]),
  O:Object.freeze([
   path('stroke','M 42 3 C 94 -4 105 82 60 106 C 12 129 -12 49 19 18 Q 30 6 42 3'),
   path('stroke','M -10 58 L 96 54'),
   path('hairline','M 21 38 Q 34 20 53 24')
  ])
 }),
 C:Object.freeze({
  A:Object.freeze([
   path('fill','M -6 102 L 34 -2 L 55 8 L 18 105 L 4 113 Z'),
   path('fill','M 44 4 L 61 -3 L 91 103 L 69 109 L 55 54 Z'),
   path('fill','M 14 55 L 77 48 L 72 67 L 7 76 Z')
  ]),
  O:Object.freeze([
   path('fill','M 24 -2 L 78 9 L 99 42 L 80 94 L 55 113 L 14 105 L -3 70 L 4 27 Z M 35 27 L 22 73 L 47 90 L 67 78 L 79 45 L 61 23 Z'),
   path('fill','M 1 24 L 36 -7 L 44 13 L 16 42 Z')
  ])
 }),
 G:Object.freeze({
  O:Object.freeze([
   path('stroke','M 37 5 C 92 -13 109 71 75 107 C 47 138 -12 104 4 46 Q 15 8 48 3'),
   path('stroke','M 36 35 C 68 14 83 47 66 76 C 52 96 25 79 30 55 Q 34 43 55 42'),
   path('hairline','M 6 65 Q 45 36 92 58')
  ]),
  S:Object.freeze([
   path('stroke','M 81 17 C 54 -14 13 3 8 30 C 0 55 57 57 74 38 Q 83 25 65 19'),
   path('stroke','M 29 52 C -12 79 15 122 54 109 C 93 95 71 60 43 74 Q 31 86 47 93'),
   path('hairline','M 13 112 Q 52 131 89 100')
  ])
 }),
 H:Object.freeze({
  A:Object.freeze([
   path('fill','M -5 104 L 29 -5 L 46 12 L 14 110 Z'),
   path('fill','M 52 6 L 78 110 L 62 101 L 38 31 Z'),
   path('fill','M 7 60 L 72 49 L 75 64 L 0 81 Z')
  ]),
  S:Object.freeze([
   path('fill','M 69 -4 L 90 7 L 60 35 L 32 21 L 15 44 L 1 32 L 27 0 Z'),
   path('fill','M 17 47 L 36 52 L 24 78 L 54 82 L 49 96 L 6 88 Z'),
   path('fill','M 33 103 L 78 77 L 91 91 L 54 116 L 8 112 L 5 95 Z')
  ])
 }),
 I:Object.freeze({
  A:Object.freeze([
   path('stroke','M 25 114 L 24 13 L 36 -1 L 53 19 L 49 45 L 28 41'),
   path('stroke','M 53 15 L 69 113'),
   path('hairline','M 23 10 L 42 -5')
  ]),
  O:Object.freeze([
   path('stroke','M 48 0 L 66 18 L 73 79 L 49 118 L 24 92 L 22 36 L 48 0'),
   path('stroke','M 26 38 L 47 20'),
   path('hairline','M 55 93 L 67 111')
  ])
 }),
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
 // Sheet 7 is fine-line skeletal writing, unlike the heavy fat-marker B in
 // production. V2 explicitly tests a slimmer instrument without touching V1.
 const instrument=f.id==='B'?{technique:'crosshand',weight:6.1,spacing:84,overlap:3,italic:.01}:{};
 return Object.freeze({...f,...instrument,name:f.name+' (source-led V2 study)',glyphs:Object.freeze(glyphs)});
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
