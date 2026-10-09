import assert from 'node:assert/strict';
import {compareRGB,withinLimits,PIXEL_THRESHOLDS,PLOTTER_LIMITS} from './plotter-metrics.mjs';

const pixels=1400*1000;
const reference=new Uint8ClampedArray(pixels*4).fill(255);
const candidate=reference.slice();
assert.deepEqual(compareRGB(reference,candidate),{mean:0,changed:0,severe:0});

// Small antialiasing differences along edges are harmless.
for(let i=0;i<pixels/10;i++)for(let c=0;c<3;c++)candidate[i*4+c]-=2;
assert.ok(withinLimits(compareRGB(reference,candidate),PLOTTER_LIMITS.fidelity));

// A small missing-stroke/blending region can pass both older limits.
candidate.set(reference);
for(let i=0;i<2100;i++)for(let c=0;c<3;c++)candidate[i*4+c]-=120;
const local=compareRGB(reference,candidate);
assert.ok(local.mean<.5&&local.changed<.002,'Fixture must pass the old mean/tail checks');
assert.ok(local.severe>.001);
assert.equal(withinLimits(local,PLOTTER_LIMITS.fidelity),false,
  'Severe pixel tail must reject a local error hidden by the mean');

const rgba=values=>new Uint8ClampedArray(values.flatMap(v=>[v,v,v,255]));
const thresholds=compareRGB(rgba([0,0,0,0]),rgba([24,25,48,49]));
assert.equal(thresholds.changed,3/4);
assert.equal(thresholds.severe,1/4);
assert.deepEqual(PIXEL_THRESHOLDS,{changed:24,severe:48});
assert.ok(withinLimits(PLOTTER_LIMITS.fidelity,PLOTTER_LIMITS.fidelity));
for(const key of Object.keys(PLOTTER_LIMITS.fidelity)){
  assert.equal(withinLimits({...PLOTTER_LIMITS.fidelity,[key]:PLOTTER_LIMITS.fidelity[key]+1e-9},
    PLOTTER_LIMITS.fidelity),false);
}
for(const invalid of [NaN,Infinity,-1,undefined]){
  assert.equal(withinLimits({mean:invalid,changed:0,severe:0},PLOTTER_LIMITS.fidelity),false);
}
assert.throws(()=>compareRGB(new Uint8ClampedArray(4),new Uint8ClampedArray(8)),/sizes disagree/);
assert.throws(()=>compareRGB(new Uint8ClampedArray(0),new Uint8ClampedArray(0)),/sizes disagree/);
assert.throws(()=>compareRGB(reference,candidate,new Uint8ClampedArray(4)),/size disagrees/);
const heat=new Uint8ClampedArray(4);
compareRGB(rgba([0]),rgba([49]),heat);
assert.deepEqual(Array.from(heat),[255,0,0,255]);
console.log('Plotter metrics: headroom, threshold boundaries and local regression checks passed.');
