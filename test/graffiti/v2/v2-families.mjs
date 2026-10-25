// V2 experimental lettering. All nine writers have independently selectable
// changes and V1's frozen production glyphs remain untouched.
import {FAMILIES as V1} from '../family-library.mjs';
export const V2_REVISION='nine-v2-study-01';
const PROFILE={
 A:{name:'Interlocked marker',aim:'Replace surplus letter flourishes with selective shared movement',tracking:12,joinRate:.34,tilt:-.10,removal:'decorative'},
 B:{name:'Arrow-cross handstyle',aim:'Preserve heavy crossings but make arrow returns controlled',tracking:5,joinRate:.35,tilt:-.035},
 C:{name:'Cut-wedge angular',aim:'Keep the strong blades, improve counter breathing',tracking:6,joinRate:0,tilt:-.055},
 D:{name:'Rectilinear block',aim:'Slight hand slant and imperfect hard-ended bars',tracking:4,joinRate:0,tilt:.055},
 E:{name:'Fractured gothic',aim:'Distinct M and H shoulders, no wandering middle connector',tracking:9,joinRate:0,tilt:.02},
 F:{name:'Broad-nib calligraffiti',aim:'More convincing pen-angle thick/thin contrast',tracking:5,joinRate:.58,tilt:.12},
 G:{name:'Rotational loops',aim:'Fewer competing loops, stronger primary movement',tracking:8,joinRate:.42,tilt:-.065,removal:'secondary'},
 H:{name:'Fragmented brush',aim:'Sharper letter relationships and fewer unnecessary cuts',tracking:4,joinRate:0,tilt:-.035},
 I:{name:'Angular chisel gestures',aim:'More decisive marker entries and drier exits',tracking:6,joinRate:0,tilt:.05}
};
const replacement={
 E:{
 H:[
  {kind:'fill',d:'M 8 107 L 8 8 L 24 -4 L 37 10 L 27 106 L 17 116 Z'},
  {kind:'fill',d:'M 63 108 L 65 13 L 82 -2 L 94 14 L 81 109 L 71 117 Z'},
  {kind:'hairline',d:'M 24 24 Q 41 5 70 20'},
  {kind:'hairline',d:'M 25 76 Q 44 59 69 73'}
 ],
 M:[
  {kind:'fill',d:'M 3 105 L 7 15 L 25 -3 L 39 13 L 30 107 L 17 117 Z'},
  {kind:'fill',d:'M 43 104 L 43 14 L 59 -4 L 73 13 L 64 107 L 50 117 Z'},
  {kind:'fill',d:'M 81 107 L 82 15 L 96 -4 L 109 14 L 101 110 L 90 118 Z'},
  {kind:'hairline',d:'M 24 23 Q 40 0 60 18 Q 73 0 92 22'}
 ]
 },
 D:{
 R:[
  {kind:'stroke',d:'M 6 108 L 6 3 L 60 3 L 84 22 L 84 50 L 59 69 L 6 69'},
  {kind:'stroke',d:'M 51 69 L 91 108'},
  {kind:'stroke',d:'M 10 24 L 60 24'},
  {kind:'hairline',d:'M 6 3 L 14 -7'}
 ]
 }
};
function adjustedGlyphs(f){
 const out=Object.create(null);
 for(const [ch,g] of Object.entries(f.glyphs)){
  let shapes=[...g.shapes];
  const custom=replacement[f.id]?.[ch];
  if(custom)shapes=custom;
  // Dense interlocked glyphs lose repetitive hairline accents; these
  // reappear only at word-level starts/endings under authored placement.
  if(f.id==='A')shapes=shapes.filter(s=>s.kind!=='hairline');
  // Orbitals retain the main gesture and one secondary counter movement,
  // rather than three equally energetic loops on every glyph.
  if(f.id==='G'&&shapes.length>2)shapes=shapes.slice(0,2);
  // Fragmented brush uses the same source strokes, but don't add
  // multiple micro-fragments where a letter already has four pieces.
  if(f.id==='H'&&shapes.length>4)shapes=shapes.slice(0,4);
  out[ch]=Object.freeze({letter:ch,shapes:Object.freeze(shapes.map(s=>Object.freeze({...s})))});
 }
 return Object.freeze(out);
}
export const FAMILIES=Object.freeze(V1.map(f=>{
 const p=PROFILE[f.id];
 if(!p)throw Error('Missing V2 development profile '+f.id);
 return Object.freeze({...f,spacing:f.spacing+p.tracking,italic:p.tilt,
   name:p.name+' · V2 study',v2Aim:p.aim,v2JoinRate:p.joinRate,
   glyphs:adjustedGlyphs(f)});
}));
export const BY_ID=Object.freeze(Object.fromEntries(FAMILIES.map(f=>[f.id,f])));
export const STYLE_NOTES=Object.freeze(Object.fromEntries(
 Object.entries(PROFILE).map(([id,p])=>[id,Object.freeze({...p})])));
if(FAMILIES.length!==9||new Set(FAMILIES.map(x=>x.id)).size!==9)
 throw Error('V2 must retain exactly nine active writer identities');
