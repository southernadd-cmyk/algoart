import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as THREE from 'three';
import {buildPhiRendererPlan} from '../test/virtual-gallery/phi-full-engine-adapter.mjs';
import {planPhiFurnishings} from '../gallery/visit/phi-furnishings.mjs';
import {planPhiLiftShaft} from '../gallery/visit/phi-lift-shaft.mjs';
import {createGothicSurroundShape} from '../gallery/visit/phi-gothic-door-profile.mjs';
test('the stone surround fits the real pointed arch without filling the walking aperture',()=>{
 const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(createGothicSurroundShape(THREE),{depth:.26,bevelEnabled:false}),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);
 const hit=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length;
 assert.equal(hit(0,1.68),0);assert.equal(hit(0,4.35),0);assert.ok(hit(1.2,1.68)>0);assert.ok(hit(.8,3.9)>0);
});
test('all shaft openings clear the actual exit path as floors rotate',()=>{
 const shaft=planPhiLiftShaft(32);
 for(const opening of shaft.openings)for(const offset of [-.59,0,.59]){
  const a=opening.angle+offset,ray=new THREE.Vector2(Math.cos(a),Math.sin(a));
  for(const p of shaft.panels.filter(p=>p.level===opening.level&&p.landing)){
   const edge=new THREE.Vector2(p.b.x-p.a.x,p.b.z-p.a.z),start=new THREE.Vector2(p.a.x,p.a.z),cross=ray.x*edge.y-ray.y*edge.x;
   if(Math.abs(cross)<1e-6)continue;
   const t=(start.x*edge.y-start.y*edge.x)/cross,u=(start.x*ray.y-start.y*ray.x)/cross;
   assert.ok(!(t>0&&u>=0&&u<=1),'Shaft pane crosses floor '+opening.level+' exit at '+offset);
  }
 }
});
test('real archive floors retain standing visitors, seating and a bounded population',()=>{
 const archive=JSON.parse(readFileSync(new URL('../gallery/tower-layouts.json',import.meta.url)));
 for(const {date} of archive.floors){
  const meta=JSON.parse(readFileSync(new URL('../gallery/'+date+'/meta.json',import.meta.url)));
  const studies=meta.entries.map((s,id)=>({id,portrait:s.orientation==='portrait',aspect:s.orientation==='portrait'?1/1.4:1.4}));
  const phi=buildPhiRendererPlan(date,studies);
  for(const lowPower of [false,true]){
   const a=planPhiFurnishings(phi,{lowPower});assert.deepEqual(a,planPhiFurnishings(phi,{lowPower}));
   assert.ok(a.benches.length>=1,date+' has no gallery bench');assert.ok(a.people.some(p=>!p.seat),date+' has no standing visitor');
   assert.ok(a.people.length<=(lowPower?2:3));assert.ok(a.people.filter(p=>p.seat).length<=1);
   for(const person of a.people)assert.ok(phi.canWalk(person.x,person.z),date+' visitor is outside the usable room');
  }
 }
});
