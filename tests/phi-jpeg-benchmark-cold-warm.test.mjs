import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTextureBenchCache} from '../test/virtual-gallery/phi-jpeg-benchmark-cache.mjs';
const base='https://southernadd-cmyk.github.io/algoart/gallery/visit/full-engine.html';
const origin=new URL(base).origin;
const asset='https://southernadd-cmyk.github.io/algoart/gallery/2026-10-05/work.jpg';
const ktx='https://southernadd-cmyk.github.io/algoart/test/virtual-gallery/ktx2-lossless/gallery/2026-10-05/work.jpg.ktx2';
test('cold runs use genuinely independent per-asset request keys',()=>{
 const a=createTextureBenchCache('?benchcache=cold&benchseed=cold-a-12345678',base,origin);
 const b=createTextureBenchCache('?benchcache=cold&benchseed=cold-b-12345678',base,origin);
 assert.ok(a);assert.ok(b);
 assert.notEqual(a.stamp(asset),b.stamp(asset));
 assert.notEqual(a.stamp(ktx),b.stamp(ktx));
 assert.equal(a.stamp(asset),a.stamp(asset),'same asset reused within visit');
 assert.ok(a.metadata().requestedAssets.length>=2);
});
test('warm runs reuse identical asset keys across iframe navigations',()=>{
 const same='?benchcache=warm&benchseed=warm-abc-1234567';
 const a=createTextureBenchCache(same,base,origin);
 const b=createTextureBenchCache(same,base,origin);
 assert.equal(a.stamp(asset),b.stamp(asset));
 assert.equal(a.stamp(ktx),b.stamp(ktx));
});
test('no bench flags means no cache modifications; nonimage assets unchanged',()=>{
 assert.equal(createTextureBenchCache('',base,origin),null);
 const cache=createTextureBenchCache('?benchcache=cold&benchseed=validseed123',base,origin);
 assert.equal(cache.stamp('https://example.com/test.png'),'https://example.com/test.png');
 assert.equal(cache.stamp('/algoart/gallery/tower-layouts.json'),'/algoart/gallery/tower-layouts.json');
 assert.equal(cache.stamp('https://example.com/x.jpg'),'https://example.com/x.jpg');
 assert.equal(createTextureBenchCache('?benchcache=cold&benchseed=x',base,origin),null);
});
test('full JPEG benchmark requires all paintings instead of fixed seven seconds',()=>{
 const html=readFileSync('test/virtual-gallery/ktx2-lossless-all-comparison.html','utf8');
 assert.match(html,/__phiFullEngine\?\.paintingsLoaded/);
 assert.match(html,/actual===expected/);
 assert.match(html,/phiArtworkPreload/);
 assert.match(html,/jpegformat=/);
 assert.match(html,/Run 4 network-cold visits/);
 assert.match(html,/Run 2 warm-ups \+ 4 warm visits/);
 assert.match(html,/phiBenchAsset/);
 assert.doesNotMatch(html,/await delay\(7000\)/);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'inline benchmarking script');
 assert.doesNotThrow(()=>new Function(script),'bench inline JavaScript syntax');
});
