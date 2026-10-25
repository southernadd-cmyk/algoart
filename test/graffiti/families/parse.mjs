// Source-led *original* gesture grammars. No third-party sheet images or traced curves are included.
// Path syntax: glyph|path|path, prefix ! = filled silhouette, ^ = hairline, $ = heavier stroke.
// Every family provides its own independently authored geometry for all 26 capitals.
export const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function parseFamily({id,name,primary,anchors,technique,ink,weight,spacing,overlap=0,italic=0,rows,notes}){
 const glyphs=Object.create(null);
 const lines=rows.trim().split('\n').map(s=>s.trim()).filter(Boolean);
 for(const line of lines){
  const [letter,...raw]=line.split('|').map(x=>x.trim());
  if(!/^[A-Z]$/.test(letter)||glyphs[letter])throw new Error('Duplicate/invalid '+id+':'+letter);
  const shapes=raw.map(x=>{
   const marker=x[0],kind=marker==='!'?'fill':marker==='^'?'hairline':marker==='$'?'heavy':'stroke';
   const d=marker==='!'||marker==='^'||marker==='$'?x.slice(1):x;
   if(!/^M\s*-?[\d.]+\s+-?[\d.]+/.test(d)||!/[LQCZ]/.test(d))throw new Error('Invalid gesture: '+id+' '+letter+' '+d);
   return Object.freeze({kind,d});
  });
  if(shapes.length<1)throw new Error('Empty glyph '+id+':'+letter);
  glyphs[letter]=Object.freeze({letter,shapes:Object.freeze(shapes)});
 }
 if(Object.keys(glyphs).length!==26||[...LETTERS].some(x=>!glyphs[x]))
  throw new Error('Family '+id+' incomplete: '+Object.keys(glyphs).sort().join(''));
 return Object.freeze({id,name,primary,anchors:Object.freeze(anchors),technique,ink,weight,spacing,overlap,italic,
  notes:Object.freeze(notes),glyphs:Object.freeze(glyphs)});
}
