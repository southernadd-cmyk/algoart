import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const A={hues:()=>['#263945'],makeR:()=>()=>.5};
const sandbox={window:{AlgoArt:A}};
for(const path of ['js/action-painting-v4.js','js/action-painting-v5.js','js/action-painting-v6.js'])
 vm.runInNewContext(readFileSync(path,'utf8'),sandbox,{filename:path});
for(const v of [4,5,6]){
 assert.equal(typeof A['actionPaintingFromPathsV'+v],'function');
 assert.equal(typeof A['renderActionPaintingV'+v],'function');
}
const load=A.actionPaintingV6Test.materialLoad;
assert(load(0,Math.PI)>.99,'Heavier head');
assert.equal(load(1,1.23),A.actionPaintingV6Test.mediumProfile(1,1.23),'V5 tail taper is unchanged');
function recorder(){
 const trace={strokes:0,arcs:0,ellipses:0,pools:0};
 const ctx={globalAlpha:1,lineWidth:1,save(){},restore(){},setTransform(){},fillRect(){},
  beginPath(){},rect(){},clip(){},translate(){},rotate(){},moveTo(){},lineTo(){},
  quadraticCurveTo(){},closePath(){},stroke(){trace.strokes++},
  arc(){trace.arcs++},ellipse(){trace.ellipses++},fill(){trace.pools++}};
 return {canvas:{getContext:()=>ctx,width:0,height:0},trace};
}
const paths=[
 {d:'M 120 100 L 1150 790',stroke:'#111'},
 {d:'M 200 790 C 320 50 1100 100 1230 850',stroke:'#333'},
 {d:'M 100 500 L 1100 500',stroke:'#666'},
 {d:'M 370 180 C 1100 100 500 900 1050 670',stroke:'#777'}
];
const original=JSON.stringify(paths),s={seed:'PHYSICS-V6-MASS',mode:'rects',
 orientation:'landscape',palette:'mono',colourCount:1,paper:'#f5f0e6'};
const opts={layers:3,density:.9};
const baseline=recorder(),v5=recorder(),v6=recorder(),v6Again=recorder(),baselineAgain=recorder();
const b=A.actionPaintingFromPathsV4(baseline.canvas,paths,s,.25,opts);
const old=A.actionPaintingFromPathsV5(v5.canvas,paths,s,.25,opts);
const n=A.actionPaintingFromPathsV6(v6.canvas,paths,s,.25,opts);
const again=A.actionPaintingFromPathsV6(v6Again.canvas,paths,s,.25,opts);
const re=A.actionPaintingFromPathsV4(baselineAgain.canvas,paths,s,.25,opts);
for(const key of ['pathCount','anchorCount','layers','skippedCrowded','bowedSourceThrows','softenedStraightRuns']){
 assert.equal(n[key],b[key],'Geometry parity '+key);
 assert.equal(old[key],b[key],'V5 geometry parity '+key);
}
assert.equal(JSON.stringify(b),JSON.stringify(re),'V4 remains bitwise stable');
assert.equal(JSON.stringify(n),JSON.stringify(again),'V6 deterministic');
assert.equal(JSON.stringify(v6.trace),JSON.stringify(v6Again.trace),'V6 reproducible draw operations');
assert.equal(JSON.stringify(paths),original,'Source paths unchanged');
assert(n.throwMass.length>0);
for(const budget of n.throwMass){
 assert(Number.isFinite(budget.reference)&&Number.isFinite(budget.current));
 assert(Math.abs(budget.changePercent)<=3,'Throw mass deviation '+budget.changePercent+'% at '+budget.layer+':'+budget.index);
}
assert(n.dryBeads>0,'Dry endings present');
assert(n.speedDroplets>0,'Kinetic deposit present');
assert(n.slowPools>0,'Slow-turn pooled deposit present');
assert(v6.canvas.width===350&&v6.canvas.height===250);
console.log('PASS V6 mass-balanced throws, V4/V5 structural preservation, deterministic rendering, physical deposits');
