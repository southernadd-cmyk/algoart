import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PHI,phiFurnitureDimensions} from '../gallery/visit/phi-reception-phi-furniture-study.mjs';
test('physical phi geometry with preserved desk and bench clearances',()=>{
 const {desk,bench}=phiFurnitureDimensions();
 for(const item of [desk,bench]){
  assert.ok(Math.abs(item.width/item.depth-PHI*PHI)<1e-10);
  assert.ok(Math.abs(item.main/item.minor-PHI)<1e-10);
 }
 assert.equal(desk.width,3.9);assert.equal(bench.width,1.85);
});
test('only staging builds the new reception study, not production',()=>{
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const live=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.match(builder,/addPhiGoldenReceptionDesk/);
 assert.match(builder,/addPhiGoldenReceptionBench/);
 assert.match(builder,/exhibitDate===RECEPTION/);
 assert.doesNotMatch(live,/addPhiGoldenReceptionDesk|addPhiGoldenReceptionBench/);
});
