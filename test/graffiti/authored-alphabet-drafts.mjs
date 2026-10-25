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
// Individually extrapolated SKUF capitals. These are original constructions,
// not documented transcriptions of the writer's unseen A-Z.
const SKUF_EXTRAPOLATED={
 A:'0.02,1 0.37,0.05 0.78,-0.03 1.02,1|0.2,0.67 0.86,0.61',
 B:'0.08,1 0.04,0.02 0.65,-0.02 0.99,0.23 0.68,0.5 0.08,0.5 0.79,0.51 1.03,0.82 0.67,1.02 0.08,1',
 C:'1.02,0.14 0.56,-0.02 0.12,0.16 -0.04,0.55 0.17,0.93 0.97,0.9',
 D:'0.06,1.04 0.07,-0.02 0.68,0.03 1.03,0.39 0.88,0.83 0.06,1.04',
 E:'0.99,0.06 0.1,-0.02 0.05,1.02 1,0.94|0.11,0.5 0.78,0.45',
 G:'0.97,0.14 0.46,-0.03 0.02,0.35 0.16,0.9 0.95,0.94 1.01,0.52 0.59,0.55',
 H:'0.07,-0.02 0.1,1.03|0.93,-0.03 0.97,1.04|0.1,0.55 0.95,0.48',
 I:'0.19,0.02 0.82,-0.02|0.53,0 0.48,1.02|0.12,1.03 0.89,0.96',
 J:'0.18,0.02 0.98,-0.02 0.92,0.8 0.55,1.04 -0.04,0.85',
 L:'0.07,-0.03 0.11,1.02 0.99,0.92',
 M:'0.05,1.03 0.08,-0.02 0.52,0.48 0.96,-0.03 0.97,1.02',
 N:'0.06,1.03 0.08,-0.02 0.95,1.02 0.96,-0.02',
 O:'0.51,-0.04 0.94,0.13 1.02,0.61 0.66,1.02 0.17,0.93 -0.03,0.45 0.51,-0.04',
 P:'0.09,1.04 0.06,0.02 0.78,-0.03 1.02,0.33 0.69,0.55 0.1,0.49',
 Q:'0.5,-0.04 0.99,0.22 0.94,0.77 0.48,1.01 0.02,0.75 0.06,0.21 0.5,-0.04|0.61,0.75 1.08,1.08',
 R:'0.09,1.03 0.08,0.02 0.79,-0.02 1.02,0.33 0.67,0.52 0.09,0.5|0.5,0.52 1.06,1.01',
 T:'0.01,0.07 1,-0.03|0.54,-0.01 0.49,1.04',
 V:'0.01,0.02 0.48,1.04 1,-0.02',
 W:'0.01,0.02 0.23,1.04 0.52,0.53 0.77,1.03 1.02,-0.02',
 X:'0.02,-0.03 0.98,1.04|1.03,-0.03 -0.02,1.03',
 Y:'0.03,-0.02 0.48,0.57 0.98,-0.03|0.48,0.57 0.52,1.04',
 Z:'0.02,0.04 1,-0.03 0.02,1.04 1.02,0.95'
};
Object.assign(SKUF_SIGNATURE,SKUF_EXTRAPOLATED);
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
