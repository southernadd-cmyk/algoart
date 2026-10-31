import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPhiLiftProfiler} from '../test/virtual-gallery/phi-lift-profile.mjs';
import {warmGalleryEntry} from '../test/virtual-gallery/gallery-entry-preparation.mjs';
import {createPhiArtworkPreloader} from '../test/virtual-gallery/phi-artwork-preload.mjs';
import {createPhiLiftPaintingGPUPreparer} from '../test/virtual-gallery/phi-lift-painting-gpu.mjs';
import {createPhiRoomGeometryStager} from '../test/virtual-gallery/phi-room-geometry-stage.mjs';

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

test('lossless KTX2 conversion is retired from the default test tower, while original JPEG mode remains',()=>{
 const source=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/createJPEGParityBank|jpegParityBank|__phiJPEGLosslessBank/);
 assert.match(source,/get\('jpegformat'\)==='original'/);
 assert.match(source,/createPhiLiftPaintingGPUPreparer/);
 assert.match(source,/liftPaintingGPU\.start\(date\)/);
 assert.match(source,/paintingGPU:liftPaintingGPU\.stats\(\)/);
});

test('painting GPU uploads are serialized across animation frames and keep decoded source',async()=>{
 const events=[],frames=[];
 const makeTexture=image=>({
  isTexture:true,image,dispose(){events.push('disposed:'+image.name);}
 });
 const p=createPhiLiftPaintingGPUPreparer({
  makeTexture,
  upload:texture=>events.push('upload:'+texture.image.name),
  nextFrame:async()=>{frames.push('frame');events.push('frame');},
  now:()=>0
 });
 p.start('2026-10-22');
 const a={name:'a'},b={name:'b'};
 const [first,second]=await Promise.all([
  p.prepare(a,{date:'2026-10-22',isCancelled:()=>false}),
  p.prepare(b,{date:'2026-10-22',isCancelled:()=>false})
 ]);
 assert.equal(first.image,a);
 assert.equal(second.image,b);
 assert.equal(frames.length,2);
 assert.deepEqual(events,['frame','upload:a','frame','upload:b']);
 assert.equal(p.stats().uploaded,2);
 assert.equal(p.stats().failed,0);
});

test('an abandoned floor never uploads its image and unused textures are disposed',async()=>{
 let disposed=0,uploaded=0,cancelled=false;
 const p=createPhiLiftPaintingGPUPreparer({
  makeTexture:image=>({image,dispose(){disposed++;}}),
  upload:()=>uploaded++,
  nextFrame:async()=>{cancelled=true;}
 });
 p.start('old');
 const value=await p.prepare({name:'old'},{
  date:'old',isCancelled:()=>cancelled
 });
 assert.equal(value,null);
 assert.equal(uploaded,0);
 assert.equal(disposed,1);
});

test('painting preloader disposes only unclaimed GPU maps on destination change',async()=>{
 const disposed=[];
 const loader=createPhiArtworkPreloader(
  async url=>({url}),{
   concurrency:2,
   prepare:async image=>({
    isTexture:true,image,dispose(){disposed.push(image.url);}
   }),
   dispose:texture=>texture?.dispose?.()
  });
 loader.start('2026-10-22',['a.jpg','b.jpg']);
 const owned=await loader.take('2026-10-22','a.jpg');
 await new Promise(resolve=>setImmediate(resolve));
 loader.start('2026-10-23',[]);
 assert.equal(owned.image.url,'a.jpg');
 assert.deepEqual(disposed,['b.jpg']);
 assert.equal(loader.stats().date,'2026-10-23');
});

test('destination room geometries are created off-scene, at most one per scheduled frame',()=>{
 const pending=[],disposed=[];
 let builds=0;
 const stage=createPhiRoomGeometryStager({
  schedule:callback=>pending.push(callback),
  create:(w,h,d)=>({w,h,d,id:++builds}),
  dispose:geometry=>disposed.push(geometry.id)
 });
 stage.start('2026-10-22',[[4,.28,6],[4,.18,6],[4,.28,6]]);
 assert.equal(stage.stats().created,0);
 pending.shift()();
 assert.equal(stage.stats().created,1);
 assert.equal(stage.stats().pending,2);
 const slab=stage.take('2026-10-22',4,.28,6);
 assert.deepEqual([slab.w,slab.h,slab.d],[4,.28,6]);
 pending.shift()();pending.shift()();
 assert.equal(builds,3);
 assert.equal(stage.stats().used,1);
 assert.equal(stage.stats().ready,2);
 assert.equal(stage.take('other',4,.28,6),null);
 stage.clear();
 assert.deepEqual(disposed,[3,2]);
 assert.equal(stage.stats().ready,0);
});

test('cancelling staged geometry prevents leftover scheduled work from building',()=>{
 const callbacks=[],disposed=[];
 const stage=createPhiRoomGeometryStager({
  schedule:callback=>callbacks.push(callback),
  create:(w,h,d)=>({w,h,d}),
  dispose:geometry=>disposed.push(geometry)
 });
 stage.start('old',[[1,2,3],[4,5,6]]);
 callbacks.shift()();
 stage.start('new',[]);
 assert.equal(disposed.length,1);
 callbacks.shift()();
 assert.equal(stage.stats().created,0);
 assert.equal(stage.stats().pending,0);
});

test('test gallery hands prepared room dimensions to original geometry constructor',()=>{
 const source=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 assert.match(source,/phiRoomGeometryStage\.start\(date,roomShapes\)/);
 assert.match(source,/phiRoomGeometryStage\.take\(exhibitDate,w,h,d\)\|\|new THREE\.BoxGeometry\(w,h,d\)/);
 assert.match(source,/phiRoomGeometryStage\.clear\(\)/);
});
