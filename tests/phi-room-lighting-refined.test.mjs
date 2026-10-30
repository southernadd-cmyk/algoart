import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {PHI} from '../gallery/visit/phi-room-lighting.mjs';
import {roomLightingEntrances,refineRoomLightEntries,planRefinedPhiRoomLighting} from '../test/virtual-gallery/phi-room-lighting-refined.mjs';
const entry=(x,z,w,h,entrance)=>({cell:{x,z,w,h},entrance,power:12,area:w*h});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('direction follows the entrance and is independent of construction order',()=>{
 const a=entry(0,0,10,8,{x:0,z:1}),b=entry(20,0,8,8,{x:28,z:7});
 const planned=planRefinedPhiRoomLighting([a,b]),reversed=planRefinedPhiRoomLighting([b,a]);
 assert.deepEqual(planned[0],reversed[1]);assert.deepEqual(planned[1],reversed[0]);
 assert.ok(planned[0].x>5&&planned[0].z>4);
 assert.ok(planned[1].x<24&&planned[1].z<4);
});
test('near-equal and equal areas receive near-equal and equal powers without a median jump',()=>{
 const a=entry(0,0,10,10),b=entry(20,0,10,10.001);
 const p=planRefinedPhiRoomLighting([a,b]);
 assert.ok(Math.abs(p[0].power-p[1].power)<.002);close(p[0].power+p[1].power,24);
 const equal=planRefinedPhiRoomLighting([a,{...b,area:a.area}]);
 close(equal[0].power,12);close(equal[1].power,12);
});
test('small-room offset eases continuously to the centre and missing entrance stays central',()=>{
 const a=entry(0,0,3,8,{x:0,z:0}),b=entry(10,0,4.5,8,{x:10,z:0}),c=entry(20,0,6,8,{x:20,z:0});
 const p=planRefinedPhiRoomLighting([a,b,c]);
 close(p[0].x,1.5);close(p[0].z,4);close(p[0].offsetScale,0);close(p[1].offsetScale,.5);close(p[2].offsetScale,1);
 const noEntrance=planRefinedPhiRoomLighting([entry(0,0,10,8)])[0];close(noEntrance.x,5);close(noEntrance.z,4);
 assert.deepEqual(planRefinedPhiRoomLighting([]),[]);
});
test('floor rotation happens exactly once',()=>{
 const entries=[entry(0,0,10,8,{x:0,z:0})],world=(x,z)=>({x:z+100,z:-x-17});
 const local=planRefinedPhiRoomLighting(entries)[0],rotated=planRefinedPhiRoomLighting(entries,world)[0];
 assert.deepEqual({x:rotated.x,z:rotated.z},world(local.x,local.z));
});
test('all archived lit rooms have an entrance, safe placement and preserved total power',()=>{
 const archive=JSON.parse(readFileSync(new URL('../gallery/tower-layouts.json',import.meta.url)));
 const report=[];
 for(const {date} of archive.floors){
  const html=readFileSync(new URL('../gallery/'+date+'/index.html',import.meta.url),'utf8');
  const studies=[...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(([card],id)=>{
   const width=Number(card.match(/<img[^>]*width="(\d+)"/)?.[1]),height=Number(card.match(/<img[^>]*height="(\d+)"/)?.[1]);
   return {id,portrait:/data-orientation="portrait"/.test(card)||height>width,aspect:width/height||1.4,
    href:card.match(/class="remix" href="([^"]+)"/)?.[1]?.replaceAll('&amp;','&')||'',material:card.match(/data-material="([^"]+)"/)?.[1]};
  });
  const phi=buildPhiRendererPlan(date,studies);
  const original=phi.floor.mergedRooms.filter(r=>r.pieces?.length).slice(0,7).map(room=>{
   const cell=[...room.pieces].sort((a,b)=>b.w*b.h-a.w*a.h)[0];return {cell,power:12};
  }).filter(e=>e.cell.w>=3&&e.cell.h>=3);
  const entries=refineRoomLightEntries(original,phi),planned=planRefinedPhiRoomLighting(entries);
  assert.equal(roomLightingEntrances(phi).size,phi.floor.mergedRooms.length,date+' unreachable lighting room');
  close(planned.reduce((sum,p)=>sum+p.power,0),entries.length*12);
  planned.forEach((p,i)=>{
   const e=entries[i],c=e.cell;assert.ok(e.entrance,date+' missing entrance');
   assert.ok(p.x>=c.x+c.w*(1-1/PHI)-1e-8&&p.x<=c.x+c.w/PHI+1e-8);
   assert.ok(p.z>=c.z+c.h*(1-1/PHI)-1e-8&&p.z<=c.z+c.h/PHI+1e-8);
   assert.ok(p.weight>=1&&p.weight<=PHI+1e-8);
   report.push({date,room:e.roomIndex,narrow:Math.min(c.w,c.h),offsetScale:p.offsetScale,
    displacement:Math.hypot(p.x-c.x-c.w/2,p.z-c.z-c.h/2),power:p.power});
  });
 }
 report.sort((a,b)=>a.narrow-b.narrow);
 console.log('REFINED_LIGHTING_AUDIT',JSON.stringify({floors:archive.floors.length,rooms:report.length,reducedOffsets:report.filter(r=>r.offsetScale<1).length,smallest:report.slice(0,5)}));
 assert.ok(report.length>0);
});
test('refinement is confined to staging; production lighting source remains pinned',()=>{
 const live=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.ok(!live.includes('phi-room-lighting-refined'));
 const build=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 assert.ok(build.includes('baselinePlanner:planPhiRoomLighting'));
 assert.ok(build.includes('planner:planRefinedPhiRoomLighting'));
});

import * as THREE from 'three';
import {createPhiLightingComparison} from '../test/virtual-gallery/phi-lighting-comparison.mjs';
import {planPhiRoomLighting} from '../gallery/visit/phi-room-lighting.mjs';
test('comparison switches between actual live and refined plans, with exact reversible snapshots',()=>{
 const buttons=['current','phi'].map(mode=>({dataset:{mode},setAttribute(){},addEventListener(){}}));
 const panel={querySelectorAll:()=>buttons,querySelector:()=>({textContent:''})};
 const oldDoc=globalThis.document,oldWin=globalThis.window;
 globalThis.document={createElement:tag=>tag==='fieldset'?panel:{},head:{append(){}},body:{append(){}}};
 globalThis.window={addEventListener(){}};
 try{
  const api=createPhiLightingComparison({planner:planRefinedPhiRoomLighting,baselinePlanner:planPhiRoomLighting,refined:true});
  const e=entry(0,0,4,9,{x:0,z:0});
  e.light=new THREE.SpotLight(0xfff3df,12);e.mount=new THREE.Group();e.fallback=new THREE.Group();
  e.light.position.set(2,4,4.5);e.light.target.position.set(2,1,4.5);e.mount.position.set(2,4.2,4.5);e.fallback.position.set(2,4.1,4.5);
  api.register(e);api.finish();const live=api.inspect(),expected=planPhiRoomLighting([e])[0];
  close(live.lights[0].position[0],expected.x);close(live.lights[0].position[2],expected.z);
  api.setMode('phi');const refined=api.inspect(),next=planRefinedPhiRoomLighting([e])[0];
  close(refined.lights[0].position[0],next.x);close(refined.lights[0].position[2],next.z);
  assert.notDeepEqual(refined.lights[0].position,live.lights[0].position);
  close(refined.totalPower,live.totalPower);assert.equal(refined.count,live.count);
  api.setMode('current');assert.deepEqual(api.inspect(),live);
 }finally{globalThis.document=oldDoc;globalThis.window=oldWin;delete globalThis.__phiLightingComparison;}
});
