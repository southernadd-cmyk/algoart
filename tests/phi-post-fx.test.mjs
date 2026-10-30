import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('test bundle A/B post FX without lighting panel; live stays unaffected',()=>{
 const b=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const l=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 const p=readFileSync(new URL('../gallery/visit/phi-post-fx.mjs',import.meta.url),'utf8');
 assert.match(b,/createPhiPostFX/);assert.match(b,/phiPostFX\.render\(dt\)/);
 assert.doesNotMatch(b,/phiLightingComparison|createPhiLightingComparison/);
 assert.doesNotMatch(l,/createPhiPostFX|phiPostFX/);
 assert.match(p,/EffectComposer/);assert.match(p,/BloomEffect/);assert.match(p,/VignetteEffect/);
 assert.match(p,/renderer\.xr\.isPresenting/);
});
