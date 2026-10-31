import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPhiLiftProfiler} from '../test/virtual-gallery/phi-lift-profile.mjs';
import {warmGalleryEntry} from '../test/virtual-gallery/gallery-entry-preparation.mjs';

test('completed artwork jobs are prioritized ahead of optional deferred furnishing jobs',()=>{
 const src=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 assert.match(src,/if\(url\)deferredGalleryJobs\.unshift\(\(\)=>\{/);
 assert.match(src,/const warmed=phiArtworkPreloader\.take\(exhibitDate,url\)/);
 assert.match(src,/texture-upload-and-compile-finished/);
 assert.match(src,/phiLiftProfiler\?\.tick\(\)/);
});

test('optional lift profiler attributes frame gaps to the active stage',()=>{
 let time=500;
 const p=createPhiLiftProfiler({enabled:true,now:()=>time});
 p.begin('2026-10-05',0,1);
 p.tick();
 time+=22;p.tick();
 p.mark('ride-finished');
 time+=1350;p.tick();
 p.finish();
 assert.equal(p.state.visits.length,1);
 assert.equal(p.state.visits[0].frames.length,1);
 assert.equal(p.state.visits[0].frames[0].deltaMs,1350);
 assert.equal(p.state.visits[0].frames[0].stage,'ride-finished');
 assert.equal(p.state.active,false);
 assert.equal(p.state.visits[0].summary.framesOver100ms,1);
 assert.equal(createPhiLiftProfiler({enabled:false}),null);
});

test('warmup diagnostics identify render versus upload/compile without changing GPU operations',async()=>{
 const ops=[],tex={isTexture:true,image:{width:128,height:64}};
 const scene={traverse:fn=>fn({material:{map:tex}})};
 const renderer={
  async compileAsync(){ops.push('compile')},
  initTexture(t){assert.equal(t,tex);ops.push('upload')},
  render(){ops.push('render')}
 };
 const stages=[];
 const result=await warmGalleryEntry({renderer,scene,camera:{},
  onStage:(name,measure)=>stages.push({name,measure}),
  nextFrame:async()=>ops.push('yield')});
 assert.deepEqual(ops,['compile','yield','upload','render','yield']);
 assert.deepEqual(result,{textures:1});
 assert.equal(stages[0].name,'warmup-details');
 assert.equal(stages[0].measure.failedUploads,0);
 assert.equal(stages[0].measure.traversalMs>=0,true);
});
