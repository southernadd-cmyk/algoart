import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPhiRendererPlan} from '../test/virtual-gallery/phi-full-engine-adapter.mjs';
import {readFileSync} from 'node:fs';
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
  assert.equal(a.checks.unplaced,0,'Every study must have a display position');
  assert.ok(a.physical.walls.length>0);
  assert.ok(a.pieces.length>0);
  assert.equal(a.canWalk(a.circulation.lift.x,a.circulation.lift.z),true);
  // Sample the complete crossing, not merely the centre of the doorway.
  for(const d of a.circulation.doors){
   for(let offset=-0.7;offset<=0.7;offset+=0.1){
    const x=d.axis==='x'?d.at+offset:d.centre;
    const z=d.axis==='z'?d.at+offset:d.centre;
    assert.ok(a.canWalk(x,z),'Blocked room-to-room transition '+d.axis+' at '+offset);
   }
  }
  for(const d of a.circulation.bridgePortals){
   for(const offset of [-.35,0,.35]){
    const x=d.axis==='x'?d.at+offset:d.centre;
    const z=d.axis==='z'?d.at+offset:d.centre;
    assert.ok(a.canWalk(x,z),'Blocked bridge/lift portal '+d.axis+' at '+offset);
   }
  }
 });
}

test('reception uses a valid deterministic phi seed and separate public doorway',()=>{
 const studies=Array.from({length:10},(_,i)=>({id:'lobby-'+i,portrait:i%3===0,aspect:1.4}));
 const plan=buildPhiRendererPlan('__phi_reception__',studies);
 assert.ok(plan.physical.walls.length>0);
 assert.ok(plan.circulation.publicEntrance);
 assert.notEqual(plan.circulation.publicEntrance.axis,plan.circulation.lift.portal.axis);
});

// Use the real archive mix: later editions contain nine portrait sculptures,
// substantially more than the old synthetic fixture's one-third portraits.
const archive=JSON.parse(readFileSync(new URL('../gallery/tower-layouts.json',import.meta.url)));
for(const {date} of archive.floors){
 test('complete real archive exhibition '+date,()=>{
  const html=readFileSync(new URL('../gallery/'+date+'/index.html',import.meta.url),'utf8');
  const studies=[...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(([card],id)=>{
   const width=Number(card.match(/<img[^>]*width="(\d+)"/)?.[1]);
   const height=Number(card.match(/<img[^>]*height="(\d+)"/)?.[1]);
   return {id,portrait:/data-orientation="portrait"/.test(card)||height>width,aspect:width/height||1.4};
  });
  assert.equal(studies.length,archive.floors.find(f=>f.date===date).studies.length,'Archive fixture differs from tower index');
  const a=buildPhiRendererPlan(date,studies);
  assert.deepEqual(a.checks,{connected:true,count:true,unique:true,inwardFacing:true,clearances:true,unplaced:0});
  assert.equal(a.exhibition.paintings.length,studies.filter(s=>!s.portrait).length);
  assert.equal(a.exhibition.sculptures.length,studies.filter(s=>s.portrait).length);
  assert.deepEqual(a.exhibition,buildPhiRendererPlan(date,studies).exhibition,'Curating must be deterministic');
 });
}
