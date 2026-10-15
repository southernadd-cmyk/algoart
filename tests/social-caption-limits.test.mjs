// Regression: no ALGO/ART social job can submit an overlong caption.
// The portrait Watercolour on 2026-10-15 had 316 Bluesky graphemes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {makeCaptions,editorArtworkLink,socialGraphemes,SOCIAL_CAPTION_LIMITS} from '../automation/captions.mjs';
assert.equal(socialGraphemes('👩‍💻'),1,'Count grapheme clusters');
const archive=JSON.parse(await fs.readFile('gallery/2026-10-15/meta.json','utf8'));
const samples=archive.entries.filter(e=>['watercolour','watercolor'].includes(e.material));
assert(samples.some(e=>e.id==='2026-10-15-CP01'),'Known missing portrait fixture');
assert(samples.some(e=>e.orientation==='landscape'),'Landscape samples');
function fixture(orientation,material,series,mode,seed,id){
 return {id,orientation,material,series,mode,seed,
   settings:{orientation,phiStrength:96,pen:'fine'}};
}
for(const item of [
  ...samples,
  ...['watercolour','watercolor','marker'].flatMap(material=>
    ['portrait','landscape'].map(orientation=>
      fixture(orientation,material,'Constructed Forms','geometric',
        'LONG-CAPTION-TEST-2026-10-15-'+'Z'.repeat(65),
        '2026-10-15-'+(orientation==='portrait'?'CP01':'CL01')))),
  fixture('portrait','watercolour','Extra long heading '+('VERY LONG '.repeat(80)),
    'geometric','X'.repeat(210),'2026-10-15-CP01')
]){
  const copy=makeCaptions(item),url=editorArtworkLink(item);
  assert.equal(typeof copy.instagram,'string');
  assert.equal(typeof copy.altText,'string');
  for(const [platform,limit] of Object.entries(SOCIAL_CAPTION_LIMITS)){
    const caption=copy[platform],size=socialGraphemes(caption);
    assert(size<=limit,platform+' exceeded '+limit+' at '+item.id+': '+size);
    assert(caption.includes(url),platform+' lost editor link for '+item.id);
    assert(caption.includes('?art='+item.id),platform+' lost artwork identity');
    assert.equal((caption.match(/https:\/\//g)||[]).length,1,
      platform+' introduced an extra/malformed URL');
  }
}
const known=samples.find(e=>e.id==='2026-10-15-CP01');
assert.equal(known.orientation,'portrait');
assert.equal(known.material,'watercolour');
assert.match(makeCaptions(known).bluesky,/WATERCOLOUR V2S/,
  'Portrait material identity must be preserved');
console.log('PASS caption budgets: material, orientation, historical 15 Oct, stress, exact links');
