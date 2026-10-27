import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {instrumentPhiSource} from '../automation/build-phi-post-test.mjs';
import {summariseFrames} from '../test/virtual-gallery/phi-postprocessing.mjs';

test('long stalls are retained in frame statistics',()=>{
 const result=summariseFrames([16,17,18,60,220,1000]);
 assert.equal(result.count,6);assert.equal(result.over50,3);assert.equal(result.over180,2);
 assert.equal(result.p95,1000);
});
test('staging transform covers both presentation branches and warm-up',()=>{
 const source=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 const transformed=instrumentPhiSource(source);
 assert.equal((transformed.match(/phiPresentation.render\(\)/g)||[]).length,2);
 assert.ok(transformed.includes('await phiPresentation?.warm()'));
 assert.ok(transformed.includes('phiPresentation?.resize()'));
 assert.throws(()=>instrumentPhiSource(source.replace('  renderer.setSize(innerWidth,innerHeight);','')),/anchor changed/);
 assert.ok(!source.includes('phiPresentation'));
});
test('live entry keeps its existing bundle and contains no experiment',()=>{
 const live=readFileSync(new URL('../gallery/visit/index.html',import.meta.url),'utf8');
 assert.ok(live.includes("import('./gallery-phi-bundle.js?"));
 assert.ok(!live.includes('phi-post-test-bundle'));
});

test('test bundle preserves the gallery asset base for import.meta.url loaders',()=>{
 const builder=readFileSync(new URL('../automation/build-phi-post-test.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../test/virtual-gallery/full-engine.html',import.meta.url),'utf8');
 const bundlePath=builder.match(/outfile:'([^']+)'/)[1];
 assert.equal(bundlePath,'gallery/visit/gallery-phi-post-test-bundle.js');
 assert.ok(html.includes('../../'+bundlePath+'?'));
 const base=new URL(bundlePath,'https://example.test/algoart/');
 assert.equal(new URL('./textures/bajwa-floor-tiles/color.webp',base).pathname,
  '/algoart/gallery/visit/textures/bajwa-floor-tiles/color.webp');
 assert.equal(new URL('./models/plants-scene-gallery-optimized.glb',base).pathname,
  '/algoart/gallery/visit/models/plants-scene-gallery-optimized.glb');
});
