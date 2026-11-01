// Offline CPU/visibility experiment for a real archived floor, not an FPS claim.
// Mirrors the archive's portrait/landscape mix and exact deterministic phi planner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {buildPhiRendererPlan} from '../test/virtual-gallery/phi-full-engine-adapter.mjs';
import {compilePhiVisibilityCells} from '../test/virtual-gallery/phi-visibility-cell-index.mjs';
import {phiRoomHiddenBehindSolidWalls} from '../test/virtual-gallery/phi-room-visibility-culler.mjs';

test('compiled cells match conservative dynamic visibility on real 20 October floor',()=>{
 const date='2026-10-20';
 const meta=JSON.parse(readFileSync(new URL('../gallery/'+date+'/meta.json',import.meta.url),'utf8'));
 const studies=meta.entries.map(e=>({id:e.id,portrait:e.orientation==='portrait',
  aspect:e.orientation==='portrait'?1/1.4:1.4,
  material:e.material||'marker',series:e.series,title:e.title}));
 const phi=buildPhiRendererPlan(date,studies);
 assert.ok(phi.floor.mergedRooms.length>0);
 const compiled=compilePhiVisibilityCells({pieces:phi.pieces,
  rooms:phi.floor.mergedRooms,walls:phi.physical.walls});
 const base={date,artworks:studies.length,rooms:phi.floor.mergedRooms.length,
  walls:phi.physical.walls.length,compiled:compiled.stats()};
 assert.equal(compiled.enabled,true,'Real archive floor must stay within cell cap');
 const probes=compiled.cells.flatMap(c=>[.2,.5,.8].map(t=>({
  point:{x:c.x0+(c.x1-c.x0)*t,z:c.z0+(c.z1-c.z0)*(1-t)},
  room:c.room
 })));
 // Every precomputed hidden room must be truly hidden at exact observer points.
 let dynamicHidden=0,precomputedHidden=0;
 const dynamic=({point,room})=>{
  const hidden=[];
  for(let target=0;target<phi.floor.mergedRooms.length;target++){
   if(target===room)continue;
   if(phiRoomHiddenBehindSolidWalls(point,phi.floor.mergedRooms[target].pieces,phi.physical.walls))
    hidden.push(target);
  }
  return hidden;
 };
 for(const p of probes){
  const expected=dynamic(p),actual=compiled.hiddenRooms(p.point,p.room);
  assert.ok(actual!==null,'Cell centre and interior samples should resolve');
  for(const i of actual)assert.ok(expected.includes(i),'PVS overculled room '+i);
  dynamicHidden+=expected.length;precomputedHidden+=actual.length;
 }
 // Compare JUST the culling decision CPU time; software/real GPU render cost
 // and daily archive compilation latency are measured separately.
 const repetitions=4;
 let baselineChecksum=0,compiledChecksum=0;
 const t0=performance.now();
 for(let pass=0;pass<repetitions;pass++)for(const probe of probes)
  baselineChecksum+=dynamic(probe).length;
 const baselineMs=performance.now()-t0;
 const t1=performance.now();
 for(let pass=0;pass<repetitions;pass++)for(const probe of probes)
  compiledChecksum+=compiled.hiddenRooms(probe.point,probe.room).length;
 const indexedMs=performance.now()-t1;
 assert.ok(compiledChecksum<=baselineChecksum);
 // Compare cell sizes against the SAME 303 real-floor viewpoints; do not
 // mistake additional cells or a different sampling density for better culling.
 const expected=probes.map(dynamic);
 const variants=[];
 for(const cellSize of [3,2.5,2,1.5,1,.75]){
  const index=compilePhiVisibilityCells({pieces:phi.pieces,
   rooms:phi.floor.mergedRooms,walls:phi.physical.walls,cellSize,maxCells:650});
  if(!index.enabled){
   variants.push({cellSize,enabled:false,reason:index.reason});continue;
  }
  let hidden=0,hits=0,misses=0;
  const scanStart=performance.now();
  for(let pass=0;pass<4;pass++)for(let i=0;i<probes.length;i++){
   const p=probes[i],actual=index.hiddenRooms(p.point,p.room);
   if(actual===null){misses++;continue;}
   hits++;
   if(pass===0)for(const room of actual)
    assert.ok(expected[i].includes(room),'PVS overculled at cell size '+cellSize);
   if(pass===0)hidden+=actual.length;
  }
  variants.push({cellSize,enabled:true,cells:index.cellCount,
   compileMs:+index.compileMs.toFixed(2),lookupCpuMs:+(performance.now()-scanStart).toFixed(2),
   hidden,baselineHidden:dynamicHidden,
   coveragePercent:dynamicHidden?+(100*hidden/dynamicHidden).toFixed(1):100,
   lookups:hits,misses});
 }
 const report={...base,probes:probes.length,dynamicHidden,precomputedHidden,
  baselineCpuMs:+baselineMs.toFixed(2),indexedCpuMs:+indexedMs.toFixed(2),
  variants,classificationOnly:true,visualBenchmarkRequired:true,
  caveat:'CPU visibility decision timing only. Does not measure scene render, GPU stalls or user-visible frame rates.'};
 writeFileSync(new URL('../test/virtual-gallery/pvs-benchmark.json',import.meta.url),
  JSON.stringify(report,null,2)+'\n');
 console.log('PVS_REAL_FLOOR '+JSON.stringify(report));
});
