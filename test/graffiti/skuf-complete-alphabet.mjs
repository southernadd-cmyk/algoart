/**
 * Original 26-letter handstyle study for PROPORTION PIECE.
 * Twenty-six independently authored stroke layouts, rather than a shared
 * skeletal font or parameter mutations of one glyph.
 *
 * Design research: the 61 A–Z sheets at Bombing Science demonstrate
 * distinct letter anatomy, hooked terminals, interrupted strokes, spatial
 * compression, and coherent alphabets. These paths are ORIGINAL designs;
 * not a tracing, licensed typeface, or authenticated SKUF alphabet.
 * https://www.bombingscience.com/graffiti-letters-61-graffiti-artists-share-their-styles/
 *
 * SKUF's observed tag identity (sweeping initial S) informs the word study,
 * but a public complete A–Z directly from SKUF has not been verified.
 */
export const ALPHABET_ID='skuf-exploration';
export const ALPHABET_REVISION='draft-a1';
const raw={
 A:{w:86,strokes:[
  'M -3 91 C 10 78 20 37 44 8 Q 51 0 57 15 C 70 37 73 74 84 94',
  'M 13 66 Q 39 55 70 57 L 83 46',
  'M 1 91 Q 13 105 28 94']},
 B:{w:77,strokes:[
  'M 12 103 C 17 78 18 33 20 -7 Q 17 5 3 13',
  'M 19 4 Q 53 -6 68 17 Q 78 36 47 47 C 78 44 88 64 71 82 Q 54 101 11 96',
  'M 24 50 Q 46 42 59 54']},
 C:{w:84,strokes:[
  'M 80 17 Q 51 -4 28 10 C -4 31 -6 77 20 92 Q 46 109 81 85',
  'M 72 15 Q 82 13 88 22 M 8 83 Q 11 96 25 102']},
 D:{w:84,strokes:[
  'M 16 103 Q 20 62 14 -1',
  'M 13 9 Q 47 -6 75 23 C 103 60 76 98 17 95',
  'M 7 103 Q 24 111 36 96']},
 E:{w:77,strokes:[
  'M 75 6 C 53 9 34 7 14 13 L 8 92 Q 34 103 77 87',
  'M 15 55 Q 44 51 67 42',
  'M 5 15 Q 15 5 24 -5 M 8 91 L -4 97']},
 F:{w:83,strokes:[
  'M 14 106 C 6 70 15 24 28 6 Q 48 -13 80 17',
  'M 13 54 Q 43 44 73 51 L 86 44',
  'M 7 104 Q 22 114 39 101']},
 G:{w:86,strokes:[
  'M 81 18 C 57 -3 27 0 12 30 C -9 67 9 100 43 100 Q 83 96 90 62',
  'M 58 62 Q 76 57 95 61 Q 86 83 76 101',
  'M 12 30 Q 4 12 22 8']},
 H:{w:82,strokes:[
  'M 8 95 C 12 65 11 33 17 1 L 23 -10',
  'M 76 -3 Q 66 43 81 99',
  'M 12 57 C 32 47 53 50 77 38',
  'M 72 94 Q 82 104 91 94']},
 I:{w:47,strokes:[
  'M 28 7 Q 18 31 24 68 Q 27 89 12 99',
  'M 12 10 Q 36 3 46 -6',
  'M 3 103 Q 27 97 39 92']},
 J:{w:70,strokes:[
  'M 12 9 Q 41 -4 69 8',
  'M 54 5 C 60 33 67 74 48 96 Q 22 125 -4 99',
  'M -3 99 Q 2 90 17 88']},
 K:{w:82,strokes:[
  'M 17 -4 C 14 31 12 67 19 104 Q 20 111 29 109',
  'M 83 0 Q 61 29 24 58 C 44 57 66 79 84 100',
  'M 74 13 L 90 -1 M 20 56 Q 11 57 2 67']},
 L:{w:76,strokes:[
  'M 24 3 C 12 36 9 70 15 94 Q 44 107 79 87',
  'M 6 94 Q 14 109 31 111 M 52 91 L 91 89']},
 M:{w:106,strokes:[
  'M 1 105 Q 16 53 17 2 C 28 15 38 51 47 67 Q 56 50 71 7 C 79 38 87 77 107 98',
  'M 13 9 Q 24 -3 31 5 M 88 84 Q 98 105 115 96',
  'M 42 71 Q 50 80 60 66']},
 N:{w:88,strokes:[
  'M 4 103 C 15 72 11 35 17 4 Q 26 -4 32 14 L 76 99',
  'M 79 -4 C 73 34 72 70 79 101',
  'M 12 15 Q 17 -6 30 -8']},
 O:{w:87,strokes:[
  'M 76 19 C 49 -4 18 8 5 38 C -10 75 15 103 44 105 C 85 102 101 57 76 19 Z',
  'M 9 69 Q 36 79 63 52 M 74 17 Q 88 18 92 27']},
 P:{w:85,strokes:[
  'M 11 106 Q 20 58 16 -4',
  'M 17 10 C 55 -7 82 5 81 29 Q 78 54 20 60',
  'M 11 56 Q 4 55 -2 64 M 65 9 Q 78 6 89 21']},
 Q:{w:91,strokes:[
  'M 74 19 C 48 -5 17 9 6 41 Q -2 77 24 97 C 59 116 98 84 87 42 Q 83 27 74 19 Z',
  'M 44 75 C 55 90 69 107 100 120',
  'M 2 43 Q -8 51 -3 66']},
 R:{w:85,strokes:[
  'M 13 104 Q 19 57 15 -3',
  'M 17 11 C 54 -6 82 6 80 28 Q 77 52 20 56',
  'M 45 54 C 65 68 79 92 95 107',
  'M 5 102 Q 15 110 29 102']},
 S:{w:111,strokes:[
  'M 106 14 C 80 -5 42 -3 19 17 C -5 36 9 54 41 62 C 75 70 97 73 87 91 C 70 115 30 111 -7 91',
  'M 99 9 Q 119 5 119 24',
  'M -8 91 Q -5 106 8 112']},
 T:{w:89,strokes:[
  'M -4 23 C 28 16 60 -5 94 9',
  'M 49 6 C 49 31 53 70 38 107 Q 35 116 48 112',
  'M 72 7 Q 91 4 103 15']},
 U:{w:85,strokes:[
  'M 9 3 C 1 34 2 74 17 92 C 35 114 70 98 75 74 Q 82 45 81 6',
  'M 73 11 Q 86 6 93 19',
  'M 14 88 Q 17 105 30 111']},
 V:{w:83,strokes:[
  'M -1 9 Q 19 49 37 103 Q 46 104 55 79 L 86 0',
  'M 74 5 Q 90 -4 99 9']},
 W:{w:119,strokes:[
  'M -2 11 C 8 46 11 80 23 104 L 52 55 Q 58 77 72 100 C 85 79 94 42 118 4',
  'M 17 100 Q 28 114 42 97 M 93 22 Q 110 -4 123 13']},
 X:{w:91,strokes:[
  'M 3 6 C 30 27 54 72 88 109',
  'M 87 -3 Q 56 39 9 98 L -3 110',
  'M 79 10 Q 91 0 102 3 M 5 94 Q 0 105 6 115']},
 Y:{w:87,strokes:[
  'M 0 3 C 8 37 30 60 47 57 Q 68 49 84 6',
  'M 49 50 Q 47 77 40 102 C 36 122 16 124 -2 113',
  'M 82 8 L 96 -3']},
 Z:{w:91,strokes:[
  'M -2 16 Q 44 1 91 13 Q 69 45 12 97 Q 54 105 96 86',
  'M 86 10 Q 93 6 101 11 M 10 96 Q 0 102 -3 114']}
};
export const HANDSTYLE_GLYPHS=Object.freeze(Object.fromEntries(
 Object.entries(raw).map(([ch,v])=>[ch,Object.freeze({width:v.w,strokes:Object.freeze(v.strokes.slice())})])));
export const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// The tower also writes phi as a standalone signature.
export const PHI_GLYPH=Object.freeze({width:86,strokes:Object.freeze([
 'M 42 -9 C 34 24 26 61 33 111 Q 34 118 46 116',
 'M 42 25 C 10 14 -4 36 5 72 Q 21 105 46 95 Q 80 97 87 58 Q 87 31 57 24',
 'M 72 29 Q 85 25 96 39'
])});
for(const ch of LETTERS){
 const g=HANDSTYLE_GLYPHS[ch];
 if(!g||g.strokes.length<2||g.strokes.some(s=>!/^M /.test(s)))throw new Error('Missing authored gesture: '+ch);
}
export function glyphFor(ch){
 const c=String(ch).toUpperCase(),g=c==='Φ'?PHI_GLYPH:HANDSTYLE_GLYPHS[c];
 if(!g)throw new RangeError('No authored uppercase glyph: '+ch);
 return g;
}
function rng(seed){let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619);
 return()=>{n=(n+0x6D2B79F5)|0;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
/** Same alphabet for all strings; plans letters as an interacting word, not an SVG font. */
export function planLetters(text,{seed='PP-AZ-01',tightness=.88,variation=.08}={}){
 const input=String(text||'').toUpperCase().replace(/[^A-ZΦ \-]/g,'').slice(0,60);
 if(!input.trim())throw new RangeError('Enter text with letters A–Z');
 if(!Number.isFinite(tightness)||tightness<.55||tightness>1.2)throw new RangeError('Invalid tightness');
 if(!Number.isFinite(variation)||variation<0||variation>.2)throw new RangeError('Invalid variation');
 const random=rng(seed+'|'+input),items=[];let x=0,prev=null;
 for(let i=0;i<input.length;i++){
  const ch=input[i];if(ch===' '){x+=35;prev=null;continue}if(ch==='-'){x+=22;prev=null;continue}
  const glyph=glyphFor(ch),pair=prev?prev+ch:'',special=({SK:-11,KU:-8,UF:-8,PR:-6,RO:-4,OR:-5,TI:-6,ON:-4,PI:-7,EC:-5})[pair]||0;
  x+=special;
  const n=variation;
  items.push({ch,index:i,x:Math.round(x*1000)/1000,y:(random()-.5)*10*n,
   lean:(random()-.5)*n*.24,scaleX:1+(random()-.5)*n,
   scaleY:1+(random()-.5)*n*.6,width:glyph.width,strokes:glyph.strokes});
  x+=glyph.width*tightness;prev=ch;
 }
 return {text:input,seed,width:x+8,height:138,items};
}
