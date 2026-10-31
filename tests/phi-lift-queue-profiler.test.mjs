import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPhiLiftProfiler} from '../test/virtual-gallery/phi-lift-profile.mjs';
import {warmGalleryEntry} from '../test/virtual-gallery/gallery-entry-preparation.mjs';
import {createPhiArtworkPreloader} from '../test/virtual-gallery/phi-artwork-preload.mjs';
import {createPhiLiftPaintingGPUPreparer} from '../test/virtual-gallery/phi-lift-painting-gpu.mjs';
import {createPhiRoomGeometryStager} from '../test/virtual-gallery/phi-room-geometry-stage.mjs';
import {createPhiPaintingArrivalGate} from '../test/virtual-gallery/phi-painting-arrival-gate.mjs';
import {phiLiftIndicatorState} from '../test/virtual-gallery/phi-lift-indicator.mjs';

test('completed artwork jobs are prioritized ahead of optional deferred furnishing jobs',()=>{
 const src=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 assert.match(src,/if\(viaLift\)attachPainting\(\)/);
 assert.match(src,/else deferredGalleryJobs\.unshift\(attachPainting\)/);
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

test('doors cannot release until all painting maps are actually attached and GPU uploaded',async()=>{
 let time=0,uploads=0;
 const gate=createPhiPaintingArrivalGate({
  date:'2026-10-22',expected:2,
  nextFrame:async()=>{time+=1;},
  upload:texture=>{assert.equal(texture.isTexture,true);uploads++},
  now:()=>time
 });
 const wall=()=>({parent:{},userData:{},material:{map:null}});
 const a=wall(),b=wall(),paintA=gate.register('A',a),paintB=gate.register('B',b);
 const textureA={isTexture:true,image:{width:32,height:32}};
 const textureB={isTexture:true,image:{width:64,height:64}};
 a.material.map=textureA;paintA.ready(textureA);
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(gate.stats().complete,false);
 b.material.map=textureB;paintB.ready(textureB);
 const result=await gate.wait({timeoutMs:1000});
 assert.equal(result.ready,2);
 assert.equal(result.expected,2);
 assert.equal(uploads,2);
 assert.equal(result.complete,true);
});

test('a painting missing its attached map cannot be counted as ready',async()=>{
 let time=0;
 const gate=createPhiPaintingArrivalGate({
  date:'2026-10-20',expected:1,nextFrame:async()=>{time++;},
  upload:()=>{},now:()=>time
 });
 const face={parent:{},userData:{},material:{map:null}};
 gate.register('unattached',face).ready({isTexture:true,image:{width:8,height:8}});
 await assert.rejects(gate.wait({timeoutMs:1000}),/Painting could not be prepared/);
 assert.equal(gate.stats().ready,0);
});

test('missing and failed paintings fail closed rather than opening incomplete exhibitions',async()=>{
 let time=0;
 const create=()=>createPhiPaintingArrivalGate({
  date:'2026-10-30',expected:1,nextFrame:async()=>{time+=3;},
  upload:()=>{},now:()=>time
 });
 const unregistered=create();
 await assert.rejects(unregistered.wait(),/Expected 1 paintings, registered 0/);
 const broken=create();
 broken.register('broken',{parent:{},userData:{},material:{map:null}}).fail(Error('404'));
 await assert.rejects(broken.wait(),/404/);
 const stalled=create();
 stalled.register('stall',{parent:{},userData:{},material:{map:null}});
 await assert.rejects(stalled.wait({timeoutMs:10}),/timed out: 0\/1 ready/);
});

test('cancelled editions cannot release the lift or upload stale artwork',async()=>{
 let uploads=0;
 const gate=createPhiPaintingArrivalGate({
  date:'2026-10-25',expected:1,nextFrame:async()=>{},
  upload:()=>uploads++
 });
 const face={parent:{},userData:{},material:{map:null}};
 gate.register('A',face);
 gate.cancel();
 await assert.rejects(gate.wait({timeoutMs:10}),/cancelled/);
 assert.equal(uploads,0);
});

test('lift wall indicator displays actual painting readiness count while stopped',()=>{
 const state=phiLiftIndicatorState({
  height:12.4,spacing:6.2,dates:['__phi_reception__','2026-10-20','2026-10-30'],
  currentFloor:2,targetFloor:2,phase:'paintings',
  paintings:{ready:7,expected:9}
 });
 assert.match(state.secondary,/Paintings 7 \/ 9/);
});

test('painting arrival gate runs before door release, without reducing source fidelity',()=>{
 const source=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 assert.match(source,/await phiPaintingGate\.wait\(/);
 assert.match(source,/phiLiftProfiler\?\.mark\('paintings-gpu-ready'/);
 assert.match(source,/if\(!phiPaintingGate\?\.stats\(\)\.complete/);
 assert.match(source,/renderer\.initTexture\(texture\)/);
 assert.match(source,/const sources=\[url,study\.image\]/);
 assert.match(source,/texture\.colorSpace=THREE\.SRGBColorSpace/);
});

test('pre-uploaded painting maps complete the door interlock without duplicate GPU work or frames',async()=>{
 const image={width:1400,height:1000},texture={isTexture:true,image};
 const attached={parent:{},userData:{},material:{map:texture}};
 let uploads=0,frames=0;
 const successfullyUploaded=new WeakSet([texture]);
 const gate=createPhiPaintingArrivalGate({
  date:'2026-10-30',expected:1,
  alreadyUploaded:tex=>successfullyUploaded.has(tex),
  upload:()=>{uploads++;},
  nextFrame:async()=>{frames++;}
 });
 gate.register('painting',attached).ready(texture);
 const report=await gate.wait({timeoutMs:10});
 assert.equal(report.complete,true);
 assert.equal(report.reused,1);
 assert.equal(report.arrivalUploads,0);
 assert.equal(uploads,0);
 assert.equal(frames,0);
 assert.equal(attached.material.map,texture,'Source painting is unchanged');
});

test('a marked texture on a missing or different wall still fails closed',async()=>{
 const texture={isTexture:true,image:{width:1400,height:1000}};
 const gate=createPhiPaintingArrivalGate({
  date:'2026-10-30',expected:1,
  alreadyUploaded:()=>true,upload:()=>{throw Error('Must not upload');},
  nextFrame:async()=>{}
 });
 const face={parent:{},userData:{},material:{map:null}};
 gate.register('detached',face).ready(texture);
 await assert.rejects(gate.wait(),/Painting could not be prepared/);
 assert.equal(gate.stats().reused,0);
 assert.equal(gate.stats().complete,false);
});

test('a painting without prior verified GPU upload still uploads normally',async()=>{
 const texture={isTexture:true,image:{width:1400,height:1000}};
 const face={parent:{},userData:{},material:{map:texture}};
 let uploads=0,frames=0;
 const gate=createPhiPaintingArrivalGate({
  date:'2026-10-31',expected:1,alreadyUploaded:()=>false,
  nextFrame:async()=>{frames++;},upload:()=>{uploads++;}
 });
 gate.register('fallback',face).ready(texture);
 const report=await gate.wait();
 assert.equal(report.reused,0);
 assert.equal(report.arrivalUploads,1);
 assert.equal(uploads,1);
 assert.ok(frames>=1);
});

test('final warmup skips only already uploaded textures and retains complete compilation/render',async()=>{
 const reused={isTexture:true,image:{width:1400,height:1000}};
 const fresh={isTexture:true,image:{width:64,height:64}};
 const uploaded=new WeakSet([reused]);
 const steps=[],stages=[];
 const scene={traverse:fn=>fn({material:{map:reused,normalMap:fresh}})};
 await warmGalleryEntry({
  scene,camera:{},renderer:{
   compileAsync:async()=>steps.push('compile'),
   initTexture:texture=>{steps.push(texture===fresh?'upload:fresh':'upload:duplicate');uploaded.add(texture);},
   render:()=>steps.push('render')
  },
  isAlreadyUploaded:texture=>uploaded.has(texture),
  markUploaded:texture=>uploaded.add(texture),
  nextFrame:async()=>steps.push('frame'),
  onStage:(name,details)=>stages.push({name,details})
 });
 assert.deepEqual(steps,['compile','frame','upload:fresh','render','frame']);
 assert.equal(stages.at(-1).details.skippedUploads,1);
 assert.equal(stages.at(-1).details.attemptedUploads,1);
 assert.equal(stages.at(-1).details.failedUploads,0);
});

test('test-only reuse A/B switch leaves original painting fidelity and door interlock intact',()=>{
 const src=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 assert.match(src,/get\('liftreuse'\)!=='0'/);
 assert.match(src,/const phiUploadPainting=texture=>\{renderer\.initTexture\(texture\);phiAlreadyUploaded\.add\(texture\);\}/);
 assert.match(src,/alreadyUploaded:phiIsUploaded/);
 assert.match(src,/isAlreadyUploaded:phiIsUploaded/);
 assert.match(src,/if\(!phiPaintingGate\?\.stats\(\)\.complete/);
 assert.match(src,/texture\.colorSpace=THREE\.SRGBColorSpace/);
});
