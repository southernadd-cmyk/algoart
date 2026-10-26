import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhiShellChunkController} from '../gallery/visit/phi-shell-cache.mjs';
function make(floorCount){
 const builds=[],disposed=[],toggles=[];
 const controller=createPhiShellChunkController({floorCount,
  createView:(start,floors,omitted)=>{const view={start,floors,omitted,visible:false};builds.push(view);return view;},
  disposeView:view=>disposed.push(view),
  toggleFloor:(floor,previous)=>toggles.push([floor,previous])
 });
 return {controller,builds,disposed,toggles};
}
test('first visit prepares one view per chunk and hides the selected level',()=>{
 const r=make(19);
 assert.equal(r.controller.activate(0),true);
 assert.equal(r.builds.length,7);
 assert.deepEqual(r.builds.slice(0,2).map(v=>v.omitted),[0,-1]);
 assert.equal(r.controller.stats().retained,7);
 assert.deepEqual(r.toggles,[[0,null]]);
});
test('lift changes reuse unchanged chunks, including repeat visits',()=>{
 const r=make(19);r.controller.activate(0);r.controller.activate(4);
 assert.equal(r.builds.length,9);
 assert.equal(r.disposed.length,0);
 r.controller.activate(4);assert.equal(r.builds.length,9);
 r.controller.activate(0);assert.equal(r.builds.length,9);
});
test('within-chunk changes dispose only the stale variant',()=>{
 const r=make(8);r.controller.activate(1);r.controller.activate(2);
 assert.equal(r.disposed.length,1);assert.equal(r.disposed[0].omitted,1);
 assert.equal(r.controller.stats().retained,3);
 r.controller.dispose();assert.equal(r.controller.stats().retained,0);
});
test('all floors hide exactly their own geometry and memory is bounded',()=>{
 const r=make(19);
 for(let floor=0;floor<19;floor++){
  r.controller.activate(floor);
  const visible=r.builds.filter(view=>view.visible);
  assert.equal(visible.length,7);
  for(const view of visible)assert.equal(view.floors.includes(floor),view.omitted===floor);
  assert.ok(r.controller.stats().retained<=14);
 }
 assert.throws(()=>r.controller.activate(19),RangeError);
});
