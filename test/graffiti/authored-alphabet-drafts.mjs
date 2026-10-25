// Distinct construction plans for the first two curated writer alphabets.
// A plan defines stroke topology, not merely pen width or decoration.
// Coordinates are normalized to the existing goldenMetrics letter frame.
// Each of the 26 capitals is present, so missing glyphs never silently
// fall back to the other writer's alphabet.
const S={
 A:'0,1 0.5,0 1,1|0.2,0.65 0.8,0.65',B:'0,1 0,0 0.7,0 1,0.25 0.7,0.5 0,0.5|0.7,0.5 1,0.75 0.7,1 0,1',
 C:'1,0.12 0.65,0 0.1,0.2 0,0.75 0.4,1 1,0.85',D:'0,1 0,0 0.6,0 1,0.3 1,0.7 0.6,1 0,1',
 E:'1,0 0,0 0,1 1,1|0,0.5 0.8,0.5',F:'0,1 0,0 1,0|0,0.5 0.8,0.5',
 G:'1,0.2 0.5,0 0,0.3 0,0.8 0.5,1 1,0.8 1,0.55 0.6,0.55',
 H:'0,0 0,1|1,0 1,1|0,0.5 1,0.5',I:'0,0 1,0|0.5,0 0.5,1|0,1 1,1',
 J:'0.2,0 1,0 1,0.75 0.65,1 0,0.8',K:'0,0 0,1|1,0 0,0.55 1,1',
 L:'0,0 0,1 1,1',M:'0,1 0,0 0.5,0.55 1,0 1,1',N:'0,1 0,0 1,1 1,0',
 O:'0.5,0 0.9,0.1 1,0.5 0.9,0.9 0.5,1 0.1,0.9 0,0.5 0.1,0.1 0.5,0',
 P:'0,1 0,0 0.75,0 1,0.25 0.75,0.5 0,0.5',Q:'0.5,0 1,0.2 1,0.8 0.5,1 0,0.8 0,0.2 0.5,0|0.6,0.7 1.1,1.1',
 R:'0,1 0,0 0.75,0 1,0.25 0.75,0.5 0,0.5|0.45,0.5 1,1',
 S:'1,0.1 0.5,0 0,0.25 0.5,0.5 1,0.75 0.5,1 0,0.9',
 T:'0,0 1,0|0.5,0 0.5,1',U:'0,0 0,0.75 0.5,1 1,0.75 1,0',
 V:'0,0 0.5,1 1,0',W:'0,0 0.25,1 0.5,0.5 0.75,1 1,0',
 X:'0,0 1,1|1,0 0,1',Y:'0,0 0.5,0.5 1,0|0.5,0.5 0.5,1',
 Z:'0,0 1,0 0,1 1,1'
};
const parse=s=>s.split('|').map(part=>part.split(' ').map(pair=>{const [x,y]=pair.split(',').map(Number);return Object.freeze({x,y});}));
// SKUF's defining name letters are independently constructed, not transformed
// from the SKOFE paths. Remaining capitals are provisional extrapolations.
const SKUF_SIGNATURE={
 S:'0.96,0.02 0.56,-0.05 0.12,0.13 -0.06,0.38 0.42,0.53 0.94,0.68 0.84,0.92 0.28,1.06 -0.09,0.91',
 K:'0.12,-0.04 0.05,0.52 0.12,1.04|0.98,0.05 0.37,0.57 0.99,1.03',
 U:'0.04,0.03 0.04,0.72 0.29,0.97 0.72,0.94 0.96,0.64 0.98,0.03',
 F:'0.13,1.04 0.09,0.18 0.4,-0.03 1.05,0.08|0.13,0.51 0.85,0.43'
};
const base=Object.freeze(Object.fromEntries(Object.entries(S).map(([ch,s])=>[ch,Object.freeze(parse(s).map(points=>Object.freeze(points)))])));
export const AUTHORED_ALPHABET_DRAFTS=Object.freeze({
 // Angular detached constructions with hard stops.
 skofe:Object.freeze({revision:2,connected:false,letters:base}),
 // Continuous, curved constructions with deliberate rounded transitions.
 skuf:Object.freeze({revision:2,connected:true,letters:Object.freeze(Object.fromEntries(Object.entries(base).map(([ch,strokes])=>[
  ch,Object.freeze((SKUF_SIGNATURE[ch]?parse(SKUF_SIGNATURE[ch]):strokes).map(stroke=>Object.freeze(stroke.map(({x,y},i)=>Object.freeze({
   x:Math.min(1.1,Math.max(-.1,x+(i%2?.06:-.04))),
   y:Math.min(1.1,Math.max(-.1,y+(i%3===1?.07:0)))
  })))))
 ])))})
});
export function draftGlyph(id,ch,metrics){
 const plan=AUTHORED_ALPHABET_DRAFTS[id];
 if(!plan||!plan.letters[ch])throw new RangeError('Missing authored glyph: '+id+'/'+ch);
 return {width:metrics.width,strokes:plan.letters[ch].map(points=>({
  smooth:plan.connected,points:points.map(p=>({x:p.x*metrics.width,y:p.y*metrics.height}))
 }))};
}
