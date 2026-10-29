import test from 'node:test';import assert from 'node:assert/strict';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {planPhiReception} from '../gallery/visit/phi-reception-layout.mjs';
import {planPhiReceptionMonitorBanks} from '../gallery/visit/phi-reception-living-monitor.mjs';
test('two matching monitor banks fit the actual backroom wall without overlap',()=>{
 globalThis.__phiReceptionTestRefresh=true;
 try{
  const p=buildPhiRendererPlan('__phi_reception__',Array.from({length:10},(_,i)=>({id:String(i),portrait:false,aspect:1.4})));
  const f=planPhiReception(p.floor,p.circulation,p.physical),banks=planPhiReceptionMonitorBanks(f.backrooms[0],f.lift,p.physical.walls);
  assert.equal(banks.length,2);assert.equal(banks[0].width,banks[1].width);assert.ok(banks[0].width>.6);
  const width=3*banks[0].width+2*banks[0].gap;
  const distance=Math.hypot(banks[1].x-banks[0].x,banks[1].z-banks[0].z);
  assert.ok(distance-width>=.379);assert.ok(distance+width<=banks[0].span-.53);
  assert.equal(banks[0].yaw,banks[1].yaw);assert.ok(banks.every(b=>b.fromPhysical));
 }finally{delete globalThis.__phiReceptionTestRefresh;}
});
