import test from 'node:test';
import assert from 'node:assert/strict';
import {PHI,planPhiRoomLighting} from '../test/virtual-gallery/phi-lighting-comparison.mjs';
const entries=[
 {cell:{x:-5,z:2,w:10,h:8},power:12},
 {cell:{x:8,z:-7,w:5,h:4},power:12},
 {cell:{x:15,z:3,w:6,h:7},power:12}
];
test('phi experiment keeps room light count and total intensity settings',()=>{
 const plan=planPhiRoomLighting(entries);
 assert.equal(plan.length,entries.length);
 assert.ok(Math.abs(plan.reduce((n,p)=>n+p.power,0)-36)<1e-10);
 assert.ok(Math.abs(plan[0].power/plan[1].power-PHI)<1e-10);
 assert.equal(plan[0].primary,true);assert.equal(plan[1].primary,false);
});
test('golden divisions stay inside each actual ceiling cell',()=>{
 const plan=planPhiRoomLighting(entries);
 plan.forEach((p,i)=>{
  const c=entries[i].cell;
  assert.ok(p.x>c.x&&p.x<c.x+c.w&&p.z>c.z&&p.z<c.z+c.h);
  assert.ok(Math.abs(Math.min((p.x-c.x)/c.w,1-(p.x-c.x)/c.w)-(1-1/PHI))<1e-10);
 });
});
test('rotated floors apply their world transform exactly once',()=>{
 const world=(x,z)=>({x:z+21,z:-x-9});
 const local=planPhiRoomLighting(entries),rotated=planPhiRoomLighting(entries,world);
 local.forEach((p,i)=>assert.deepEqual({x:rotated[i].x,z:rotated[i].z},world(p.x,p.z)));
});
test('empty and single-room floors preserve valid settings',()=>{
 assert.deepEqual(planPhiRoomLighting([]),[]);
 assert.equal(planPhiRoomLighting(entries.slice(0,1))[0].power,12);
});

import * as THREE from 'three';
import {createPhiLightingComparison} from '../test/virtual-gallery/phi-lighting-comparison.mjs';
test('switching restores exact light, target and fixture positions across floor changes',()=>{
 const buttons=['current','phi'].map(mode=>({dataset:{mode},setAttribute(){},addEventListener(){}}));
 const panel={querySelectorAll:()=>buttons,querySelector:()=>({textContent:''})};
 const previousDocument=globalThis.document,previousWindow=globalThis.window;
 globalThis.document={createElement:tag=>tag==='fieldset'?panel:{},head:{append(){}},body:{append(){}}};
 globalThis.window={addEventListener(){}};
 try{
  const api=createPhiLightingComparison();
  const create=(x,z)=>{
   const light=new THREE.SpotLight(0xffffff,12);
   const mount=new THREE.Group(),fallback=new THREE.Group();
   light.position.set(x,7,z);light.target.position.set(x,4,z);
   mount.position.set(x,7.2,z);fallback.position.set(x,7.1,z);
   return {light,mount,fallback,cell:{x:0,z:0,w:8,h:6},power:12};
  };
  const first=create(24,-13);api.register(first);api.finish({toWorld:(x,z)=>({x:z+21,z:-x-9})});
  const baseline=api.inspect();
  for(let i=0;i<8;i++){api.setMode('phi');api.setMode('current');}
  assert.deepEqual(api.inspect(),baseline,'repeated toggles must not accumulate position drift');
  assert.deepEqual(first.mount.position.toArray(),[24,7.2,-13]);
  assert.deepEqual(first.fallback.position.toArray(),[24,7.1,-13]);
  api.setMode('phi');const variant=api.inspect();
  assert.equal(variant.lights[0].shadow,false);
  assert.equal(variant.lights[0].position[0],variant.lights[0].target[0]);
  assert.equal(variant.lights[0].position[2],variant.lights[0].target[2]);
  api.reset();assert.equal(api.inspect().count,0);
  const next=create(4,3);api.register(next);api.finish();
  api.setMode('current');assert.deepEqual(next.light.position.toArray(),[4,7,3]);
 }finally{
  globalThis.document=previousDocument;globalThis.window=previousWindow;
  delete globalThis.__phiLightingComparison;
 }
});
