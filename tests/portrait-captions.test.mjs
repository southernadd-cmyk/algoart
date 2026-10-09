import assert from 'node:assert/strict';
import {makeCaptions,editorArtworkLink} from '../automation/captions.mjs';
const day='2026-10-09';
const item={id:day+'-P01',series:'Connected Fields',stats:'Connected Fields / Network-Diagonal',mode:'network',seed:'AP-20261009-01-62304',settings:{orientation:'portrait',phiStrength:100,pen:'broad'},shareUrl:'https://southernadd-cmyk.github.io/algoart/?'+('a=123&').repeat(105)};
const exactEditorLink='https://southernadd-cmyk.github.io/algoart/?art='+item.id;
assert.equal(editorArtworkLink(item),exactEditorLink);
const captions=makeCaptions(item);
assert.ok([...captions.threads].length<=500,'Threads 500-character limit');
assert.ok([...captions.bluesky].length<=300,'Bluesky 300-grapheme limit');
for(const platform of ['threads','bluesky']){
  assert.ok(captions[platform].includes(exactEditorLink),platform+' must link directly to exact image in editor');
  assert.ok(!captions[platform].includes('/gallery/'),platform+' must never link to gallery');
  assert.ok(!captions[platform].includes('\nhttps://southernadd-cmyk.github.io/algoart/\n'),platform+' must never contain generic homepage link');
}
const landscape={...item,id:day+'-01',settings:{...item.settings,orientation:'landscape'}};
for(const platform of ['threads','bluesky']){
  assert.ok(makeCaptions(landscape)[platform].includes('/?art='+landscape.id));
}
assert.throws(()=>editorArtworkLink({...item,id:'../../other'}));
console.log('PASS: Threads and Bluesky captions fit platform limits and link directly to exact editor artwork states for portrait and landscape.');
