import assert from 'node:assert/strict';
import {makeCaptions, artworkGalleryLink} from '../automation/captions.mjs';

const day='2026-10-09';
const item={id:day+'-P01',series:'Connected Fields',stats:'Connected Fields / Network-Diagonal',mode:'network',seed:'AP-20261009-01-62304',settings:{orientation:'portrait',phiStrength:100,pen:'broad'},shareUrl:'https://southernadd-cmyk.github.io/algoart/?'+('a=123&').repeat(105)};
const expected='https://southernadd-cmyk.github.io/algoart/gallery/'+day+'/#'+item.id;
assert.equal(artworkGalleryLink(item),expected);
const captions=makeCaptions(item);
assert.ok([...captions.threads].length<=500,'Threads 500-character limit');
assert.ok(captions.threads.includes(expected),'Compact link must target exact artwork anchor');
assert.ok(!captions.threads.includes(item.shareUrl),'Do not include overlong share URL');
assert.ok(captions.bluesky.length<=300,'Bluesky limit');
assert.ok(captions.instagram.includes('ALGO/ART.'));
const landscape={...item,id:day+'-01',settings:{...item.settings,orientation:'landscape'}};
assert.ok([...makeCaptions(landscape).threads].length<=500,'Landscape must also fit');
console.log('PASS: Threads captions are under 500 characters for both formats, exact gallery anchors point to remix links, and Bluesky text is short.');
