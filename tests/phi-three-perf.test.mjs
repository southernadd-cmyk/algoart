import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('test/virtual-gallery/phi-three-perf.mjs','utf8');
const stub=`class ThreePerf{constructor(){this.ui={wrapper:{style:{}}};this.starts=0;this.ends=0;}begin(){this.starts++;}end(){this.ends++;}}`;
const {mountPhiThreePerf}=await import('data:text/javascript,'+encodeURIComponent(source.replace("import {ThreePerf} from 'three-perf';",stub)));
globalThis.location={search:''};globalThis.document={body:{}};globalThis.window={};globalThis.matchMedia=()=>({matches:false});
function renderer(){return {render(){},info:{autoReset:true},setAnimationLoop(fn){this.loop=fn;}};}
test('complete frames and early returns end their measurement, including thrown errors',()=>{
 const r=renderer(),p=mountPhiThreePerf(r);
 r.setAnimationLoop(()=>42);assert.equal(r.loop(),42);
 r.setAnimationLoop(()=>{throw Error('frame');});assert.throws(()=>r.loop(),/frame/);
 assert.equal(p.starts,2);assert.equal(p.ends,2);
 r.setAnimationLoop(null);assert.equal(r.loop,null);
});
test('perf=0 leaves renderer and animation loop untouched',()=>{
 location.search='?perf=0';const r=renderer(),before=r.setAnimationLoop;
 assert.equal(mountPhiThreePerf(r),null);assert.equal(r.setAnimationLoop,before);location.search='';
});
test('instrumentation is injected only in the test build',()=>{
 assert.doesNotMatch(readFileSync('gallery/visit/gallery-phi.js','utf8'),/mountPhiThreePerf|three-perf/);
 assert.match(readFileSync('automation/build-phi-test-room-signs.mjs','utf8'),/mountPhiThreePerf\(renderer\)/);
});
