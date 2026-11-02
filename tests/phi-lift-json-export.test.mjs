import assert from 'node:assert/strict';
import test from 'node:test';
import {buildLiftBenchmarkReport,summariseLiftVisit} from '../test/virtual-gallery/phi-lift-benchmark-export.mjs';
import {createPhiLiftProfiler} from '../test/virtual-gallery/phi-lift-profile.mjs';

test('export attributes an actual measured blocking operation, not last stage',()=>{
 const visit={
  date:'2026-11-01',fromFloor:0,toFloor:28,start:100,
  summary:{ms:400,frameP50Ms:16,frameP95Ms:80,
   largestFrameGapMs:90,framesOver100ms:0,operationTotals:{
    'render-frame-postfx':{count:2,totalMs:60,maxMs:60}}},
  frameMs:[16,16,90],frames:[{elapsedMs:190,deltaMs:90,stage:'paintings-waiting'}],
  operations:[{name:'render-frame-postfx',elapsedMs:125,durationMs:60}],
  longTasks:[{elapsedMs:120,durationMs:61}],
  stages:[{name:'selection',elapsedMs:0},{name:'paintings-waiting',elapsedMs:95},
   {name:'doors-opening',elapsedMs:360},{name:'doors-fully-open',elapsedMs:400}]
 };
 const report=buildLiftBenchmarkReport({active:false,visits:[visit]},{userAgent:'unit-test'});
 assert.equal(report.version,8);
 const exported=report.journeys[0];
 assert.equal(exported.status,'completed');
 assert.equal(exported.direction,'G → 28');
 assert.equal(exported.frames.maxMs,90);
 assert.equal(exported.worstFrames[0].attribution.operation,'render-frame-postfx');
 assert.equal(exported.worstFrames[0].attribution.status,'observed synchronous blocking');
 assert.equal(exported.durationsMs.paintingGate,null);
 assert.equal(report.environment.userAgent,'unit-test');
 assert.deepEqual(JSON.parse(JSON.stringify(report)),report);
});
test('unattributed rendering spike is not falsely assigned to last stage',()=>{
 const x=summariseLiftVisit({
  fromFloor:28,toFloor:0,date:'__phi_reception__',summary:{ms:200},
  frameMs:[150],frames:[{elapsedMs:180,deltaMs:150,stage:'scene-reveal-start'}],
  stages:[{name:'scene-reveal-start',elapsedMs:100},{name:'doors-fully-open',elapsedMs:200}],
  operations:[],longTasks:[]
 });
 assert.equal(x.direction,'28 → G');
 assert.equal(x.worstFrames[0].attribution.status,'unattributed');
});
test('profiler samples synchronous operation and finishes after physical doors fully open',()=>{
 let clock=100;
 const p=createPhiLiftProfiler({enabled:true,now:()=>clock});
 p.begin('2026-11-01',0,28);
 p.mark('ride-started');clock=120;
 p.measure('build-floor-meshes',()=>{clock=145;return 5});
 p.tick();clock=245;p.tick();
 p.mark('doors-opening');clock=250;p.finish();
 assert.equal(p.state.active,false);
 assert.equal(p.state.current.summary.largestFrameGapMs,100);
 assert.equal(p.state.current.summary.operationTotals['build-floor-meshes'].count,1);
 assert.equal(p.state.current.operations[0].durationMs,25);
 assert.equal(p.state.current.stages.at(-1).name,'doors-fully-open');
});

test('Chromium long-animation-frame source attribution beats stage-only guessing',()=>{
 const v=summariseLiftVisit({
  fromFloor:0,toFloor:28,date:'2026-11-01',summary:{ms:300},
  frameMs:[120],frames:[{elapsedMs:240,deltaMs:120,stage:'paintings-waiting'}],
  stages:[{name:'paintings-waiting',elapsedMs:100}],
  operations:[],longTasks:[],
  longAnimationFrames:[{
   elapsedMs:130,durationMs:95,blockingDurationMs:50,
   scripts:[{functionName:'buildSculptureGeometry',sourcePath:'/gallery-phi.js',durationMs:70}]
  }]
 });
 assert.equal(v.worstFrames[0].attribution.status,'browser script-function attribution');
 assert.equal(v.worstFrames[0].attribution.functionName,'buildSculptureGeometry');
});

test('attribution prefers a measured expensive named render pass over its outer frame wrapper',()=>{
 const x=summariseLiftVisit({
  fromFloor:0,toFloor:27,date:'2026-10-31',summary:{ms:10000},
  frameMs:[8000],frames:[{elapsedMs:9000,deltaMs:8000,stage:'paintings-waiting'}],
  stages:[{name:'paintings-waiting',elapsedMs:999},{name:'doors-fully-open',elapsedMs:10000}],
  operations:[
   {name:'render-frame-postfx',elapsedMs:1001,durationMs:7980},
   {name:'pass-main-scene',elapsedMs:1003,durationMs:7600},
   {name:'pass-n8ao',elapsedMs:8604,durationMs:200}
  ],longTasks:[]
 });
 assert.equal(x.worstFrames[0].attribution.status,'observed render-pass blocking');
 assert.equal(x.worstFrames[0].attribution.operation,'pass-main-scene');
 assert.equal(x.worstFrames[0].matchingOperations[0].name,'render-frame-postfx');
});
