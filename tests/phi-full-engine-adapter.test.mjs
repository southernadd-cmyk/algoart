import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPhiRendererPlan} from '../test/virtual-gallery/phi-full-engine-adapter.mjs';
for(const count of [10,12,16,18,20]){
 test('phi renderer adapter preserves '+count+' studies',()=>{
  const studies=Array.from({length:count},(_,i)=>({id:'edition-'+i,portrait:i%3===0,aspect:i%3===0?.75:1.4}));
  const a=buildPhiRendererPlan('2026-10-26',studies);
  const b=buildPhiRendererPlan('2026-10-26',studies);
  assert.deepEqual(a.checks,b.checks);
  assert.equal(a.checks.count,true);
  assert.equal(a.checks.unique,true);
  assert.equal(a.checks.inwardFacing,true);
  assert.equal(a.checks.clearances,true);
  assert.equal(a.checks.connected,true);
  assert.ok(a.physical.walls.length>0);
  assert.ok(a.pieces.length>0);
  assert.equal(a.canWalk(a.circulation.lift.x,a.circulation.lift.z),true);
 });
}
