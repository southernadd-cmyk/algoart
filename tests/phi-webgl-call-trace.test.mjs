import test from 'node:test';
import assert from 'node:assert/strict';
import {attachPhiWebGLCallTrace} from '../test/virtual-gallery/phi-webgl-call-trace.mjs';
import {summariseLiftVisit,buildLiftBenchmarkReport} from '../test/virtual-gallery/phi-lift-benchmark-export.mjs';

test('opt-in WebGL trace forwards original return, receiver and arguments',()=>{
 let time=100,invocations=0,receiver;
 const gl={
  drawElements(...args){receiver=this;invocations++;time+=250;return args.length+5;},
  texImage2D(){time+=10;return 'uploaded';}
 };
 const calls=[];
 const profile={state:{active:false},recordOperation:(...a)=>calls.push(a)};
 const trace=attachPhiWebGLCallTrace(gl,profile,{now:()=>time,minMs:2});
 assert.equal(trace.enabled,true);
 assert.equal(trace.installed,2);
 assert.equal(gl.drawElements(2,3,4),8);
 assert.equal(receiver,gl);
 assert.equal(calls.length,0);
 profile.state.active=true;
 assert.equal(gl.drawElements(4),6);
 assert.equal(gl.texImage2D(), 'uploaded');
 assert.equal(calls[0][0],'gl-drawElements');
 assert.equal(calls[0][2],250);
 assert.equal(calls[1][0],'gl-texImage2D');
 assert.equal(invocations,2);
});
test('one long WebGL driver call outranks its parent scene and frame render spans',()=>{
 const v=summariseLiftVisit({
  fromFloor:0,toFloor:27,date:'2026-10-31',
  frameMs:[8300],frames:[{elapsedMs:8400,deltaMs:8300,stage:'doors-opening'}],
  summary:{ms:8500},stages:[{name:'selection',elapsedMs:0},{name:'doors-fully-open',elapsedMs:8500}],
  operations:[
   {name:'render-frame-postfx',elapsedMs:101,durationMs:8290},
   {name:'pass-main-scene',elapsedMs:103,durationMs:8270},
   {name:'gl-drawElements',elapsedMs:108,durationMs:8130},
  ],longTasks:[]
 });
 assert.equal(v.worstFrames[0].attribution.operation,'gl-drawElements');
 assert.equal(v.worstFrames[0].attribution.status,'observed WebGL driver-call blocking');
 assert.equal(v.webglCallSpikes[0].durationMs,8130);
 const exportJSON=buildLiftBenchmarkReport({visits:[]});
 assert.equal(exportJSON.version,8);
});
