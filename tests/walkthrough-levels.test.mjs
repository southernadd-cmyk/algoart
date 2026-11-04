import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Run the actual inline production algorithms rather than copies of the
// algorithms in the tests. No browser or renderer mocks are needed here.
const html=readFileSync('about/step-by-step/index.html','utf8');
const section=(start,end)=>{
 const first=html.indexOf(start),last=html.indexOf(end,first);
 assert.ok(first>=0&&last>first,'Missing source range: '+start);
 return html.slice(first,last);
};
const source=[
 section('const familyAlias=', 'const familyText='),
 section('function pickByActivity(', 'function buildMaterialLevels('),
 section('function selectCheckpoints(', 'function stepTotal('),
 'globalThis.api={stageFamily,pickByActivity,frameDistance,selectCheckpoints};'
].join('\n');
const context={};
vm.runInNewContext(source,context);
const {pickByActivity,selectCheckpoints}=context.api;
const normal=value=>Array.from(value);

test('high activity in one capture does not collapse a requested level',()=>{
 const indices=Array.from({length:80},(_,i)=>i+1),activity=Array(82).fill(0);
 activity[2]=100000;
 const selected=normal(pickByActivity(indices,12,activity));
 assert.equal(selected.length,12);
 assert.equal(new Set(selected).size,12);
 assert.equal(selected.at(-1),80);
 assert.deepEqual(selected.slice().sort((a,b)=>a-b),selected);
});

test('zero-change activity still selects a full distributed level',()=>{
 const indices=Array.from({length:30},(_,i)=>i),activity=Array(30).fill(0);
 const selected=normal(pickByActivity(indices,9,activity));
 assert.equal(selected.length,9);
 assert.equal(selected.at(-1),29);
 assert.ok(selected.some(i=>i<10)&&selected.some(i=>i>20));
});

test('checkpoint cap keeps the final image despite many phase boundaries',()=>{
 const d=Array.from({length:200},(_,i)=>({phase:'tissue-'+i}));
 const a=Array(200).fill(1);
 const steps=normal(selectCheckpoints(d,a,24));
 assert.ok(steps.length<=24);
 assert.equal(steps[0],0);
 assert.equal(steps.at(-1),199);
 assert.equal(new Set(steps).size,steps.length);
 assert.deepEqual(steps.slice().sort((x,y)=>x-y),steps);
});

test('checkpoint selection includes finish when stages are uniform',()=>{
 const d=Array.from({length:120},()=>({phase:'oil-source'}));
 const a=Array(120).fill(1);
 const steps=normal(selectCheckpoints(d,a,24));
 assert.equal(steps.length,24);
 assert.equal(steps.at(-1),119);
});

test('frame cap and honest label remain wired to production capture',()=>{
 assert.match(html,/MATERIAL_FRAME_LIMIT=48/);
 assert.match(html,/retained\.push\(entry\);\s*evictLeastUseful\(\)/);
 assert.match(html,/all:'Every retained change'/);
 assert.match(html,/distinctCaptureCount=distinctCount/);
});
