import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPhiLiftProfiler} from '../test/virtual-gallery/phi-lift-profile.mjs';
import {installPhiShadowRenderProbe} from '../test/virtual-gallery/phi-shadow-render-probe.mjs';
import {createPhiArrivalMeshStager} from '../test/virtual-gallery/phi-arrival-mesh-stager.mjs';
import {installPhiComposerPassProfiler} from '../test/virtual-gallery/phi-postfx-pass-profiler.mjs';
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
 assert.match(src,/get\('liftreuse'\)==='1'/);
 assert.match(src,/get\('liftpipeline'\)==='1'/);
 assert.match(src,/const phiUploadPainting=texture=>\{renderer\.initTexture\(texture\);phiAlreadyUploaded\.add\(texture\);\}/);
 assert.match(src,/alreadyUploaded:phiIsUploaded/);
 assert.match(src,/isAlreadyUploaded:phiIsUploaded/);
 assert.match(src,/if\(!phiPaintingGate\?\.stats\(\)\.complete/);
 assert.match(src,/texture\.colorSpace=THREE\.SRGBColorSpace/);
});

test('test pipeline starts decoding subsequent images even with two long pending GPU uploads',async()=>{
 const decoded=[],preparers=[];
 const preloader=createPhiArtworkPreloader(
  async url=>{decoded.push(url);return {url};},
  {
   concurrency:2,releaseAfterDecode:true,
   prepare:image=>new Promise(resolve=>preparers.push({image,resolve}))
  }
 );
 preloader.start('2026-10-20',['a.jpg','b.jpg','c.jpg','d.jpg']);
 for(let i=0;i<35;i++)await Promise.resolve();
 assert.deepEqual(decoded,['a.jpg','b.jpg','c.jpg','d.jpg'],
  'Download/decode slots must release before GPU upload completion');
 assert.equal(preparers.length,4);
 assert.equal(preloader.stats().decoded,4);
 assert.equal(preloader.stats().preparing,4);
 assert.equal(preloader.stats().loading,0);
 const awaiting=preloader.take('2026-10-20','a.jpg');
 for(const item of preparers)item.resolve({isTexture:true,image:item.image});
 const texture=await awaiting;
 assert.equal(texture.image.url,'a.jpg');
 assert.equal(preloader.stats().preparing,0);
 preloader.clear();
});

test('pipeline A/B baseline keeps the download slots occupied until GPU upload finishes',async()=>{
 const decoded=[],preparers=[];
 const preloader=createPhiArtworkPreloader(
  async url=>{decoded.push(url);return {url};},
  {
   concurrency:2,releaseAfterDecode:false,
   prepare:image=>new Promise(resolve=>preparers.push({image,resolve}))
  }
 );
 preloader.start('2026-10-20',['a.jpg','b.jpg','c.jpg','d.jpg']);
 for(let i=0;i<35;i++)await Promise.resolve();
 assert.deepEqual(decoded,['a.jpg','b.jpg']);
 assert.equal(preloader.stats().loading,2);
 preparers[0].resolve({isTexture:true,image:preparers[0].image});
 for(let i=0;i<35;i++)await Promise.resolve();
 assert.deepEqual(decoded,['a.jpg','b.jpg','c.jpg']);
 preloader.clear();
 for(const item of preparers.slice(1))item.resolve(null);
});

test('clearing pipeline session prevents late GPU completions from opening stale floors',async()=>{
 let prepareFinished;
 let disposed=0;
 const preloader=createPhiArtworkPreloader(
  async url=>({url}),
  {releaseAfterDecode:true,prepare:()=>new Promise(resolve=>prepareFinished=resolve),
   dispose:value=>value?.dispose?.()}
 );
 preloader.start('old',['a.jpg']);
 for(let i=0;i<20;i++)await Promise.resolve();
 const claim=preloader.take('old','a.jpg');
 preloader.clear();
 prepareFinished({isTexture:true,dispose:()=>disposed++});
 assert.equal(await claim,null);
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(disposed,1);
});

test('lift profiler separates synchronous lighting/render work from frame gaps',()=>{
 let time=10;
 const profiler=createPhiLiftProfiler({enabled:true,now:()=>time});
 profiler.begin('2026-10-20',0,16);
 profiler.record('lighting-update',3.5);
 profiler.record('render-frame',18);
 profiler.record('render-frame',75.2);
 profiler.record('render-frame',88.5);
 time+=100;
 profiler.tick();time+=100;
 profiler.tick();
 profiler.finish();
 const visit=profiler.state.visits.at(-1);
 assert.equal(visit.operations['lighting-update'].count,1);
 assert.equal(visit.operations['render-frame'].count,3);
 assert.equal(visit.operations['render-frame'].over50ms,2);
 assert.equal(visit.operations['render-frame'].maxMs,88.5);
 assert.deepEqual(visit.operationSpikes.map(v=>v.ms),[88.5,75.2]);
 assert.equal(visit.frames.length,1);
 assert.equal(visit.frames[0].deltaMs,100);
});

test('staging profiler probes lighting and postprocessing without changing shaders or painting source',()=>{
 const source=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 assert.match(source,/phiLiftProfiler\.record\('lighting-update'/);
 assert.match(source,/phiLiftProfiler\.record\('render-frame'/);
 assert.match(source,/phiPostFX\.render\(dt,/);
 assert.match(source,/get\('liftpipeline'\)==='1'/);
 assert.match(source,/get\('liftreuse'\)==='1'/);
});

test('lift profile stops collecting frame spikes once doors have opened',()=>{
 let time=100;
 const profiler=createPhiLiftProfiler({enabled:true,now:()=>time});
 profiler.begin('2026-10-15',0,11);
 profiler.tick();time+=100;profiler.tick();
 profiler.finish();
 const visit=profiler.state.visits.at(-1),saved=visit.frames.length;
 time+=20000;profiler.tick();
 assert.equal(visit.frames.length,saved);
 assert.equal(visit.summary.largestFrameGapMs,100);
 assert.equal(visit.summary.ms,100);
 assert.equal(visit.stages.at(-1).name,'doors-opening');
 assert.ok(visit.frames.every(frame=>frame.elapsedMs<=visit.summary.ms));
});

test('test-only composer probe attributes exact existing enabled pass CPU calls',()=>{
 let clock=0;
 class Composer{
  constructor(passes){this.passes=passes;}
  render(dt){
   for(const pass of this.passes)if(pass.enabled!==false)pass.render(dt);
   return 'rendered';
  }
 }
 const calls=[];
 const render={constructor:{name:'RenderPass'},enabled:true,render(dt){calls.push(['render',dt]);clock+=42;}};
 const ao={constructor:{name:'N8AOPostPass'},enabled:true,render(dt){calls.push(['ao',dt]);clock+=12;}};
 const disabled={constructor:{name:'OffPass'},enabled:false,render(){throw Error('disabled pass executed');}};
 const composer=new Composer([render,ao,disabled]);
 const records=[];
 const profiler=installPhiComposerPassProfiler({
  enabled:true,Composer,now:()=>clock,
  record:(name,ms)=>records.push([name,ms])
 });
 assert.equal(profiler.installed,true);
 assert.equal(composer.render(.016),'rendered');
 assert.deepEqual(calls,[['render',.016],['ao',.016]]);
 assert.ok(records.some(([name,ms])=>name==='postfx-pass:0:scene-render'&&ms===42));
 assert.ok(records.some(([name,ms])=>name==='postfx-pass:1:artwork-copy'&&ms===12));
 assert.ok(records.some(([name,ms])=>name==='postfx-composer-total'&&ms===54));
 assert.ok(!records.some(([name])=>name.includes('OffPass')));
 profiler.dispose();
 assert.equal(composer.render(.032),'rendered');
 assert.equal(records.length,3,'Disposed composer instrumentation does not add more entries');
});

test('disabled post-FX probe has no runtime mutation or instrumentation',()=>{
 class Composer{render(){return 123;}}
 const original=Composer.prototype.render;
 const diag=installPhiComposerPassProfiler({
  enabled:false,Composer,record:()=>{throw Error('Disabled probe must not be called');}
 });
 assert.equal(diag.installed,false);
 assert.equal(Composer.prototype.render,original);
});

test('post-FX pass profiling is staging-only and source paintings remain protected',()=>{
 const testSource=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 const liveSource=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.match(testSource,/installPhiComposerPassProfiler\(/);
 assert.match(testSource,/enabled:!!phiLiftProfiler/);
 assert.match(testSource,/phiPostFX\.render\(dt/);
 assert.doesNotMatch(liveSource,/installPhiComposerPassProfiler|phi-postfx-pass-profiler/);
});

test('test scene staging keeps lift cabin visible and restores original mesh visibility',async()=>{
 let frames=0;
 const stager=createPhiArrivalMeshStager({nextFrame:async()=>{frames++;}});
 const group=(name,children=[])=>{
  const obj={name,visible:true,children,parent:null,userData:{},traverse(fn){
   fn(this);for(const child of this.children)child.traverse?child.traverse(fn):fn(child);
  }};
  for(const child of children)child.parent=obj;
  return obj;
 };
 const mesh=(name,art=false)=>({name,isMesh:true,visible:true,userData:{phiArtOriginal:art}});
 const cabinMesh=mesh('cabin door'),cabin=group('cabin',[cabinMesh]);
 const painting=mesh('painting',true),paintingRoot=group('paintingRoot',[painting]);
 const wall=mesh('wall'),frame=mesh('frame'),unshown=mesh('originally hidden');
 unshown.visible=false;
 const room=group('room',[wall,frame,unshown]);
 const started=stager.start('2026-10-09',[cabin,paintingRoot,room],{exclude:cabin});
 assert.equal(started.total,3);
 assert.equal(painting.visible,false);
 assert.equal(wall.visible,false);
 assert.equal(frame.visible,false);
 assert.equal(cabinMesh.visible,true,'physical cabin and doors must never disappear');
 assert.equal(unshown.visible,false);
 const stages=[];
 const completed=await stager.reveal({batchSize:1,
  onBatchStart:info=>stages.push(info),
 });
 assert.equal(completed.hidden,0);
 assert.equal(completed.shown,3);
 assert.equal(frames,6,'allow two real animation-frame turns per batch');
 assert.equal(stages.length,3);
 assert.equal(stages.reduce((sum,s)=>sum+s.paintings,0),1);
 assert.equal(painting.visible,true);
 assert.equal(wall.visible,true);
 assert.equal(unshown.visible,false);
 stager.restore();
 assert.equal(painting.visible,true);
 assert.equal(wall.visible,true);
 assert.equal(unshown.visible,false);
});

test('cancelled scene staging restores every surviving painting and wall',async()=>{
 let trigger=null;
 const stager=createPhiArrivalMeshStager({nextFrame:async()=>trigger?.()});
 const room={visible:true,userData:{},children:[],traverse(fn){fn(this);for(const child of this.children)fn(child)}};
 const art=Array.from({length:3},(_,i)=>({isMesh:true,parent:room,visible:true,
  userData:{phiArtOriginal:i===0}}));
 room.children.push(...art);
 stager.start('2026-10-09',[room]);
 trigger=()=>{trigger=null;stager.restore();};
 await assert.rejects(stager.reveal({batchSize:1}),/cancelled/);
 assert.equal(stager.stats().hidden,0);
 assert.ok(art.every(mesh=>mesh.visible===true));
});

test('scene batch feature is opt-in and all artwork is prepared before scene reveal and door opening',()=>{
 const src=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 const live=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.match(src,/get\('liftstage'\)==='1'/);
 assert.match(src,/exclude:phiLiftCabin/);
 assert.match(src,/await phiArrivalMeshes\.reveal/);
 assert.match(src,/phiArrivalMeshes\.restore\(\)/);
 assert.ok(src.indexOf('await phiPaintingGate.wait(')<src.indexOf('await phiArrivalMeshes.reveal('));
 assert.ok(src.indexOf('await phiArrivalMeshes.reveal(')<src.indexOf('setLiftDoors(false);',src.indexOf('await phiPaintingGate.wait(')));
 assert.doesNotMatch(live,/phiArrivalMeshes|createPhiArrivalMeshStager/);
});

test('shadow-map probe measures synchronous shader and shadow preparation without replacing rendering',()=>{
 let time=100;
 const result={target:'original'};
 const shadowMap={render(...args){time+=230;return result;}};
 const original=shadowMap.render;
 const events=[];
 const probe=installPhiShadowRenderProbe({enabled:true,renderer:{shadowMap},
  now:()=>time,record:(name,ms)=>events.push({name,ms})});
 assert.equal(probe.stats.installed,true);
 assert.equal(shadowMap.render(['sun','spot']),result);
 assert.equal(probe.stats.calls,1);
 assert.equal(probe.stats.maxMs,230);
 assert.equal(probe.stats.last.lights,2);
 assert.deepEqual(events,[{name:'shadow-map-render',ms:230}]);
 probe.dispose();
 assert.equal(shadowMap.render,original);
 assert.equal(shadowMap.render(),result);
 assert.equal(probe.stats.calls,1,'no measurements after disposal');
});

test('inactive shadow profiler does not wrap WebGL renderer',()=>{
 let called=0;
 const shadowMap={render(){called++;}};
 const original=shadowMap.render;
 const probe=installPhiShadowRenderProbe({enabled:false,renderer:{shadowMap}});
 assert.equal(probe.stats.installed,false);
 assert.equal(shadowMap.render,original);
 shadowMap.render();
 assert.equal(called,1);
});

test('stalled scene render preserves lightweight shadow and geometry snapshot',()=>{
 let clock=0;
 const profile=createPhiLiftProfiler({enabled:true,now:()=>clock});
 profile.begin('2026-10-09',0,5);
 profile.record('postfx-pass:0:scene-render',4480,{
  shadow:{ms:4000,at:4000,lights:2},
  shadowCalls:7,shaderPrograms:25,drawCalls:355,sceneRoots:80
 });
 clock+=5000;
 profile.finish();
 const spike=profile.state.visits[0].operationSpikes[0];
 assert.equal(spike.details.shadow.ms,4000);
 assert.equal(spike.details.shaderPrograms,25);
 assert.equal(spike.stage,'selection');
});

test('shadow diagnostics are test-only and retain exact live shader and shadow setup',()=>{
 const testSource=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 const live=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.match(testSource,/installPhiShadowRenderProbe\(/);
 assert.match(testSource,/shadowRefreshes:phiLightingStudy\?\.stats\?\.refreshes/);
 assert.doesNotMatch(live,/installPhiShadowRenderProbe|phi-shadow-render-probe/);
});

test('render-aware adaptive lift batches show every mesh and wait for exactly one completed render',async()=>{
 let scheduledFrames=0;
 const stager=createPhiArrivalMeshStager({nextFrame:async()=>{scheduledFrames++;}});
 const parent={visible:true,userData:{},children:[],traverse(fn){fn(this);for(const child of this.children)fn(child)}};
 const art=Array.from({length:50},(_,i)=>({isMesh:true,visible:true,parent,
  userData:{phiArtOriginal:i===16},name:'mesh'+i}));
 parent.children.push(...art);
 stager.start('2026-10-09',[parent]);
 const started=[],completed=[];
 const pending=stager.reveal({mode:'adaptive',batchSize:12,minBatch:6,maxBatch:24,
  onBatchStart:x=>started.push(x),onBatch:x=>completed.push(x)});
 assert.equal(started[0].count,12);
 assert.equal(stager.stats().shown,0,'must not claim a batch complete before scene render');
 assert.equal(art.filter(x=>x.visible).length,12);
 const frames=[100,8,10,120,12,9,8,10,8];
 for(const ms of frames){
  stager.renderedFrame(ms);
  for(let k=0;k<8;k++)await Promise.resolve();
  if(!stager.stats().active)break;
 }
 const result=await pending;
 assert.equal(result.shown,50);
 assert.equal(result.hidden,0);
 assert.equal(art.every(x=>x.visible),true);
 assert.equal(scheduledFrames,0,'adaptive mode must not add any idle rAF waits');
 assert.equal(started[0].count,12);
 assert.equal(started[1].count,6,'slow scene render halves the following batch');
 assert.equal(started[2].count,10,'fast scene render grows the following batch');
 assert.equal(completed.length,started.length);
 assert.equal(completed.reduce((sum,x)=>sum+x.paintings,0),1);
 assert.ok(completed.every(x=>Number.isFinite(x.renderMs)));
 assert.ok(result.batches.length<50);
});

test('one-render-per-batch fixed size never changes shaders, paintings or original visibility',async()=>{
 let frames=0;
 const stager=createPhiArrivalMeshStager({nextFrame:async()=>frames++});
 const parent={visible:true,userData:{},children:[],traverse(fn){fn(this);for(const x of this.children)fn(x)}};
 const meshes=Array.from({length:27},(_,i)=>({isMesh:true,visible:true,parent,userData:{phiArtOriginal:i===13}}));
 parent.children.push(...meshes);
 stager.start('2026-10-09',[parent]);
 const done=stager.reveal({mode:'render',batchSize:8});
 let completed=0;
 while(stager.stats().active&&completed<10){
  stager.renderedFrame(16);
  for(let k=0;k<5;k++)await Promise.resolve();
  completed++;
 }
 const result=await done;
 assert.equal(frames,0);
 assert.deepEqual(result.batches.map(x=>x.count),[8,8,8,3]);
 assert.equal(result.hidden,0);
 assert.ok(meshes.every(x=>x.visible));
});

test('render-aware reveal cancellation resolves its pending render and restores original art',async()=>{
 const stager=createPhiArrivalMeshStager({nextFrame:async()=>{}});
 const parent={visible:true,userData:{},children:[],traverse(fn){fn(this);for(const x of this.children)fn(x)}};
 const art={isMesh:true,parent,visible:true,userData:{phiArtOriginal:true}};
 parent.children=[art];
 stager.start('2026-10-09',[parent]);
 const pending=stager.reveal({mode:'adaptive',batchSize:6});
 stager.restore();
 await assert.rejects(pending,/cancelled/);
 assert.equal(art.visible,true);
 assert.equal(stager.stats().hidden,0);
});

test('test-only adaptive batch is opt-in and waits for a completed postFX render',()=>{
 const testSource=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 const live=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.match(testSource,/get\('liftbatch'\)/);
 assert.match(testSource,/phiLiftBatchChoice==='adaptive'/);
 assert.match(testSource,/phiArrivalMeshes\.renderedFrame\(renderMs\)/);
 assert.match(testSource,/mode:phiLiftBatchMode,batchSize:phiLiftBatchSize/);
 assert.doesNotMatch(live,/liftbatch|phiLiftBatchMode|renderedFrame/);
});

test('fixed batch 16 keeps two real rAF turns and restores complete artwork unchanged',async()=>{
 let frames=0;
 const stager=createPhiArrivalMeshStager({nextFrame:async()=>{frames++;}});
 const parent={visible:true,userData:{},children:[],traverse(fn){fn(this);for(const child of this.children)fn(child)}};
 const mesh=Array.from({length:33},(_,i)=>({isMesh:true,parent,visible:true,
  userData:{phiArtOriginal:i===15}}));
 parent.children.push(...mesh);
 stager.start('2026-10-09',[parent]);
 const report=await stager.reveal({mode:'legacy',batchSize:16});
 assert.equal(frames,6);
 assert.deepEqual(report.batches.map(x=>x.count),[16,16,1]);
 assert.equal(report.batches.reduce((n,b)=>n+b.paintings,0),1);
 assert.ok(mesh.every(x=>x.visible),'all original mesh visibility must return');
});

test('fixed-size test choices never enable rejected one-render adaptive pacing',()=>{
 const src=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 assert.match(src,/phiLiftBatchMode=phiLiftBatchChoice==='adaptive'\?'adaptive':'legacy'/);
 assert.match(src,/\[8,12,16,20,24,32\]\.includes\(Number\(phiLiftBatchChoice\)\)/);
});
