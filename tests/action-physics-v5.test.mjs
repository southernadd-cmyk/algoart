import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Pure Node smoke check: no browser, fixture images, or network required.
const A={hues:()=>['#314f63'],makeR:()=>()=>.5};
const sandbox={window:{AlgoArt:A}};
for(const path of ['js/action-painting-v4.js','js/action-painting-v5.js'])
 vm.runInNewContext(readFileSync(path,'utf8'),sandbox,{filename:path});

assert.equal(typeof A.renderActionPaintingV4,'function');
assert.equal(typeof A.renderActionPaintingV5,'function');
assert.equal(typeof A.actionPaintingFromPathsV4,'function');
assert.equal(typeof A.actionPaintingFromPathsV5,'function');
const profile=A.actionPaintingV5Test.mediumProfile;
assert(profile(0,0)>.96);
assert(profile(1,0)<profile(0,0)*.58,'Late paint becomes depleted');
assert.equal(profile(-1,0),profile(0,0));
assert.equal(profile(2,0),profile(1,0));

function instrumented(){
 const trace={strokes:0,arcs:0,ellipses:0,fills:0,paths:0};
 const ctx={
  setTransform(){},fillRect(){},save(){},restore(){},beginPath(){trace.paths++},
  rect(){},clip(){},translate(){},rotate(){},moveTo(){},lineTo(){},
  quadraticCurveTo(){},closePath(){},stroke(){trace.strokes++},
  arc(){trace.arcs++},ellipse(){trace.ellipses++},fill(){trace.fills++}
 };
 return {canvas:{getContext:()=>ctx,width:0,height:0},trace};
}
const s={
 seed:'PHYSICS-TEST-1618',mode:'rects',orientation:'landscape',
 palette:'mono',colourCount:1,paper:'#f5f0e6'
};
const paths=[
 {d:'M 80 170 L 1070 760',stroke:'#121212'},
 {d:'M 90 790 C 250 180 820 900 1150 180',stroke:'#3c3c3c'},
 {d:'M 230 120 L 900 120',stroke:'#555555'},
 {d:'M 240 850 L 1020 850',stroke:'#888888'}
];
const frozen=JSON.stringify(paths),opts={layers:3,density:.9};
const v4=instrumented(),v5=instrumented(),repeat=instrumented(),v4again=instrumented();
const base=A.actionPaintingFromPathsV4(v4.canvas,paths,s,.25,opts);
const next=A.actionPaintingFromPathsV5(v5.canvas,paths,s,.25,opts);
const again=A.actionPaintingFromPathsV5(repeat.canvas,paths,s,.25,opts);
const baseAgain=A.actionPaintingFromPathsV4(v4again.canvas,paths,s,.25,opts);
assert.equal(JSON.stringify(paths),frozen,'Original vector paths stay unchanged');
for(const key of ['pathCount','anchorCount','layers','skippedCrowded','bowedSourceThrows','softenedStraightRuns'])
 assert.equal(next[key],base[key],key+' must preserve V4 structural decisions');
assert.equal(JSON.stringify(base),JSON.stringify(baseAgain),'V4 remains unchanged after V5');
assert.equal(JSON.stringify(next),JSON.stringify(again),'V5 deterministic stats');
assert.equal(JSON.stringify(v5.trace),JSON.stringify(repeat.trace),'V5 deterministic draw calls');
assert(next.dryBeads>0,'Depletion makes some marks break into beads');
assert(next.speedDroplets>=0&&next.slowPools>=0,'Physical effect counters exposed');
assert(v5.canvas.width===350&&v5.canvas.height===250,'Portrait/landscape size unchanged');
assert.deepEqual(Object.keys(A.actionPaintingV5Test).sort(),
 ['kineticDroplets','mediumProfile','softenStraightRuns','structuralPour'].sort());
console.log('PASS Action V5: deterministic, geometry/placement decisions match V4, unchanged source, paint depletion, separate version.');
