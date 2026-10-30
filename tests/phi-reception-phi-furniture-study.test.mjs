import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PHI,phiFurnitureDimensions} from '../gallery/visit/phi-reception-phi-furniture-study.mjs';

test('live reception furniture uses phi proportions and retains its clearances',()=>{
 const {desk,bench}=phiFurnitureDimensions();
 for(const item of [desk,bench]){
  assert.ok(Math.abs(item.width/item.depth-PHI*PHI)<1e-10);
  assert.ok(Math.abs(item.main/item.minor-PHI)<1e-10);
 }
 assert.equal(desk.width,3.9);assert.equal(bench.width,1.85);
});
test('test and live use the exact same phi desk and bench, with no chair behind the desk',()=>{
 const stage=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const live=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 const study=readFileSync(new URL('../gallery/visit/phi-reception-phi-furniture-study.mjs',import.meta.url),'utf8');
 assert.match(live,/import \{addPhiGoldenReceptionDesk,addPhiGoldenReceptionBench\}/);
 assert.match(live,/phiReceptionDesk=addPhiGoldenReceptionDesk\(THREE,scene,furnishing,elevation\)/);
 assert.match(live,/if\(exhibitDate===RECEPTION\)/);
 assert.match(live,/for\(const bench of furniture\.benches\)addPhiGoldenReceptionBench/);
 assert.doesNotMatch(stage,/replace\([\s\S]*?phiReceptionDesk=addPhiGoldenReceptionDesk/);
 assert.doesNotMatch(study,/addPhiOfficeChair|kind:'chair'/);
 assert.match(study,/obstacles:\[cabinet\]\.filter\(Boolean\)/);
 assert.match(study,/phi-golden-reception-desk/);
 assert.match(study,/phi-golden-reception-bench/);
});
