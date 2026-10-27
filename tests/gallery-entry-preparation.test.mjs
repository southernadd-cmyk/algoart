import test from 'node:test';
import assert from 'node:assert/strict';
import {trackGalleryLoading,waitForGalleryEntry,warmGalleryEntry} from '../gallery/visit/gallery-entry-preparation.mjs';
test('loader tracking preserves callbacks and restores the manager',()=>{
 const calls=[],manager={itemStart(url){calls.push(['start',url,this]);},itemEnd(url){calls.push(['end',url,this]);}};
 const old=manager.itemStart,loading=trackGalleryLoading(manager);
 manager.itemStart('a');manager.itemStart('b');manager.itemEnd('a');assert.equal(loading.pending,1);
 manager.itemEnd('b');assert.equal(loading.pending,0);assert.equal(calls[0][2],manager);
 loading.dispose();assert.equal(manager.itemStart,old);
});
test('entry waits for loaders, deferred jobs and late model continuations',async()=>{
 let at=0,jobs=2;const loading={pending:1};
 const result=await waitForGalleryEntry({loading,isBusy:()=>jobs>0,pump:()=>{jobs=Math.max(0,jobs-1);},now:()=>at,
  nextFrame:async()=>{at++;if(at===2)loading.pending=0;if(at===3)jobs=1;},timeout:20});
 assert.equal(result.timedOut,false);assert.ok(at>=6);assert.equal(jobs,0);
});
test('a stalled optional network request cannot prevent entry indefinitely',async()=>{
 let at=0;const result=await waitForGalleryEntry({loading:{pending:1},isBusy:()=>false,pump:()=>{},now:()=>at,nextFrame:async()=>{at+=10;},timeout:30});
 assert.equal(result.timedOut,true);assert.equal(at,30);
});
test('warm-up compiles final materials and uploads each shared texture once before rendering',async()=>{
 const texture={isTexture:true},target={isTexture:true,isRenderTargetTexture:true},calls=[];
 const scene={traverse(fn){fn({material:[{map:texture,normalMap:texture,envMap:target}]});}};
 const renderer={async compileAsync(s){assert.equal(s,scene);calls.push('compile');},initTexture(t){assert.equal(t,texture);calls.push('upload');},render(){calls.push('render');}};
 const result=await warmGalleryEntry({renderer,scene,camera:{},nextFrame:async()=>calls.push('yield')});
 assert.equal(result.textures,1);assert.deepEqual(calls,['compile','yield','upload','render','yield']);
});
