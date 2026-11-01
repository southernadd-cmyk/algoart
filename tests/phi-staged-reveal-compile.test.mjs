import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhiArrivalMeshStager} from '../test/virtual-gallery/phi-arrival-mesh-stager.mjs';

const make=()=>({isMesh:true,visible:true,parent:{},userData:{}});
test('TEST-only compiler receives original staged visibility but restores meshes before awaiting',async()=>{
 const a=make(),b=make(),skipped=make();
 skipped.userData.galleryDisposed=true;
 const stage=createPhiArrivalMeshStager({nextFrame:async()=>{}});
 stage.start('2026-10-20',[{traverse:fn=>[a,b,skipped].forEach(fn)}]);
 assert.equal(a.visible,false);assert.equal(b.visible,false);
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const job=stage.compileHiddenDestination(()=>{
  assert.equal(a.visible,true);assert.equal(b.visible,true);
  assert.equal(skipped.visible,true); // disposed is not staged
  return gate;
 });
 assert.equal(job.attempted,true);
 assert.equal(job.count,2);
 assert.equal(a.visible,false);
 assert.equal(b.visible,false);
 assert.equal(stage.stats().shown,0);
 release();
 await job.promise;
 assert.equal(a.visible,false);
 assert.equal(stage.stats().hidden,2);
 await stage.reveal({mode:'legacy',batchSize:16});
 assert.equal(a.visible,true);assert.equal(b.visible,true);
});
test('compiler exceptions preserve original staged mesh invisibility and the old reveal path',async()=>{
 const a=make();
 const stage=createPhiArrivalMeshStager({nextFrame:async()=>{}});
 stage.start('2026-10-30',[{traverse:fn=>fn(a)}]);
 assert.throws(()=>stage.compileHiddenDestination(()=>{
  assert.equal(a.visible,true);
  throw Error('synthetic shader failure');
 }),/synthetic shader failure/);
 assert.equal(a.visible,false);
 await stage.reveal({mode:'legacy'});
 assert.equal(a.visible,true);
});
test('precompile is disabled for non-running or empty destinations',()=>{
 const stage=createPhiArrivalMeshStager({nextFrame:async()=>{}});
 let invoked=0;
 const result=stage.compileHiddenDestination(()=>{invoked++;});
 assert.equal(result.attempted,false);
 assert.equal(result.promise,null);
 assert.equal(invoked,0);
});
