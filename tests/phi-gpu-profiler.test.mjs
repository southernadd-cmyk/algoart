import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhiGpuProfiler} from '../test/virtual-gallery/phi-gpu-profiler.mjs';

test('opt-in only and never needs a GPU query to collect CPU timings',()=>{
 const gl={getExtension:()=>null};
 const renderer={getContext:()=>gl,info:{render:{calls:12,triangles:80}}};
 assert.equal(createPhiGpuProfiler(renderer),null);
 let now=0;
 const p=createPhiGpuProfiler(renderer,{enabled:true,now:()=>now});
 for(let i=0;i<3;i++){p.begin();now+=2;p.end();}
 const stats=p.snapshot();
 assert.equal(stats.supported,false);
 assert.equal(stats.samples,1);
 assert.equal(stats.cpuMs.median,2);
 assert.equal(stats.gpuMs,null);
 assert.equal(stats.drawCalls.median,12);
});
test('WebGL query results are collected only after availability is signalled',()=>{
 let ready=false,readEarly=false,deleted=0,now=0;
 const gl={
  QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,
  getExtension:()=>({TIME_ELAPSED_EXT:42,GPU_DISJOINT_EXT:43}),
  getParameter:()=>false,createQuery:()=>({}),
  beginQuery(){},endQuery(){},deleteQuery(){deleted++;},
  getQueryParameter(_q,kind){if(kind===1)return ready;if(!ready)readEarly=true;return 4200000;}
 };
 const renderer={getContext:()=>gl,info:{render:{calls:8,triangles:160}}};
 const p=createPhiGpuProfiler(renderer,{enabled:true,now:()=>now});
 for(let i=0;i<3;i++){p.begin();now+=3;p.end();}
 assert.equal(p.snapshot().pending,1);
 assert.equal(readEarly,false);
 ready=true;
 const stats=p.snapshot();
 assert.equal(stats.pending,0);
 assert.equal(stats.gpuMs.median,4.2);
 assert.equal(deleted,1);
 p.reset();
 assert.equal(p.snapshot().samples,0);
});
