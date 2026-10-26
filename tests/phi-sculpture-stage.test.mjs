import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhiSculptureStager} from '../gallery/visit/phi-sculpture-stage.mjs';
function rig(){
 const frames=[],built=[],disposed=[];
 const staging=createPhiSculptureStager({
  schedule:callback=>frames.push(callback),
  create:entry=>{built.push(entry.id);return {id:entry.id};},
  dispose:pivot=>disposed.push(pivot.id)
 });
 const frame=()=>{const next=frames.shift();assert.ok(next);next();};
 return {staging,frames,built,disposed,frame};
}
test('prepare one sculpture per frame and hand off the exact object',()=>{
 const r=rig();r.staging.start('2026-10-25',[{id:1},{id:2},{id:3}]);
 assert.equal(r.built.length,0);
 r.frame();assert.deepEqual(r.built,[1]);
 const one=r.staging.take('2026-10-25',1);
 assert.deepEqual(one,{id:1});
 assert.equal(r.staging.take('2026-10-25',1),null);
 r.frame();r.frame();
 assert.equal(r.staging.stats().ready,2);
 r.staging.clear();
 assert.deepEqual(r.disposed,[2,3]);
 assert.ok(!r.disposed.includes(one.id));
});
test('switching destinations cancels old queued work',()=>{
 const r=rig();
 r.staging.start('old',[{id:'old-a'},{id:'old-b'}]);
 r.frame();
 r.staging.start('new',[{id:'new-a'}]);
 assert.deepEqual(r.disposed,['old-a']);
 // A scheduled old callback is still waiting; it must do nothing.
 r.frame();assert.deepEqual(r.built,['old-a']);
 r.frame();assert.deepEqual(r.built,['old-a','new-a']);
 assert.equal(r.staging.take('old','old-a'),null);
 assert.deepEqual(r.staging.take('new','new-a'),{id:'new-a'});
});
test('duplicate studies stage once, and failures retain fallback behavior',()=>{
 const frames=[],made=[],disposed=[];
 const s=createPhiSculptureStager({
  schedule:cb=>frames.push(cb),
  create:x=>{made.push(x.id);if(x.id==='broken')throw Error('decode');return {id:x.id};},
  dispose:x=>disposed.push(x.id)
 });
 s.start('d',[{id:'ok'},{id:'ok'},{id:'broken'},{id:'next'}]);
 while(frames.length)frames.shift()();
 assert.deepEqual(made,['ok','broken','next']);
 assert.equal(s.stats().failed,1);
 assert.equal(s.take('d','broken'),null);
 s.clear();assert.deepEqual(disposed,['ok','next']);
});
