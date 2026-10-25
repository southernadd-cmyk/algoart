// Experimental SKUF word-composition study, separate from the legacy renderer.
// This is an original *inference* from photographed works, not a tracing,
// endorsed alphabet, or a transcription of an undocumented A-Z.
// Sources: https://www.vice.com/en/article/skuf-what-happens-when-a-legendary-graffiti-writer-grows-up/
// https://carnagenyc.com/home/2015/12/3/december-3-skuf-ykk
// https://rooftoplegends2010.blogspot.com/2010/06/skuf-ykk.html
// Reference observations: sweeping initial S; compact K/U; expanded terminal F;
// significant overlap, variable stroke direction and off-axis bowls.
export const SKUF_STUDY_VERSION='word-composition-1';
const glyphs=Object.freeze({
 S:Object.freeze({advance:113,paths:[
  'M 110 22 C 77 -7 29 -9 9 25 C -4 47 12 62 49 65 C 85 68 101 79 85 97 C 64 122 17 116 -8 94',
  'M 88 14 C 107 6 118 14 119 31'
 ]}),
 K:Object.freeze({advance:68,paths:[
  'M 19 7 C 11 34 8 74 19 108',
  'M 76 10 C 60 32 43 46 18 60 C 43 63 59 83 74 106'
 ]}),
 U:Object.freeze({advance:69,paths:[
  'M 7 12 C 0 52 5 93 26 100 C 47 111 64 82 69 17',
  'M 68 17 Q 75 35 75 43'
 ]}),
 F:Object.freeze({advance:111,paths:[
  'M 23 110 C 10 77 14 34 29 8 C 53 -1 91 7 112 27',
  'M 22 58 C 46 48 75 47 100 57',
  'M 23 109 C 32 117 43 115 48 109'
 ]})
});
export function planSkufName(text='SKUF'){
 if(String(text).toUpperCase()!=='SKUF')throw new RangeError('This reference-led study only supports observed SKUF letters as a word; it is not a full alphabet');
 const offsets=[0,99,158,217];
 const chars='SKUF'.split('').map((ch,i)=>({
  ch,x:offsets[i],paths:glyphs[ch].paths,advance:glyphs[ch].advance
 }));
 return Object.freeze({width:328,height:140,characters:chars,
  // Deliberate intersecting envelopes — each letter is composed in context.
  offsets:Object.freeze(offsets)});
}
export function skufNameSvg(){
 const p=planSkufName();
 const groups=p.characters.map(({ch,x,paths})=>'<g data-letter="'+ch+'" transform="translate('+x+' 0)">'+paths.map(d=>'<path d="'+d+'"/>').join('')+'</g>').join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -15 360 155" role="img" aria-label="SKUF reference-led lettering study"><g fill="none" stroke="#242923" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">'+groups+'</g></svg>';
}
