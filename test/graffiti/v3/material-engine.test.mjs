import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,wallSample,strokeProfile,V3_MATERIAL_REVISION} from './material-engine.mjs';
test('material samples are deterministic across runs and locations',()=>{
 for(const surface of ['brick','painted-plaster','rough-plaster']){
  assert.deepEqual(wallSample(surface,27,48,'fixed'),wallSample(surface,27,48,'fixed'));
  assert.notDeepEqual(wallSample(surface,27,48,'fixed'),wallSample(surface,270,480,'fixed'));
 }
 assert.equal(hash('x',2,3),hash('x',2,3));
 assert.match(V3_MATERIAL_REVISION,/material-study/);
});
test('brick mortar interrupts deposited paint contact',()=>{
 const face=wallSample('brick',55,23,'fixed');
 const joint=wallSample('brick',55,42,'fixed');
 assert.equal(face.mortar,0);
 assert.ok(joint.mortar>0.5);
});
test('stroke pressure and speed remain physical and finite',()=>{
 for(let index=0;index<9;index++)for(let step=0;step<=20;step++){
  const p=strokeProfile(step/20,'fixed',index);
  assert.ok(p.pressure>0&&p.pressure<=1);
  assert.ok(p.speed>=0&&p.speed<=1);
  assert.ok(Number.isFinite(p.angle));
 }
});
