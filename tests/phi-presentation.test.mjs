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

// Exercise the same planner, painter state and obstacle coordinates used in the scene.
import {phiLiftIndicatorState,paintPhiLiftIndicator} from '../gallery/visit/phi-lift-indicator.mjs';
import {planPhiSquare,planSquareTags,clearOfPhiSquare,GOLDEN_ANGLE,SQUARE_TAG_COUNTS,SQUARE_TAG_FORMS} from '../gallery/visit/phi-square-graffiti.mjs';
test('lift indicator follows physical floors in both directions and retains archive dates',()=>{
 const dates=['__phi_reception__','2026-10-05','2026-10-06','2026-10-07'];
 const up=[0,6.2,12.4,18.6].map(height=>phiLiftIndicatorState({height,dates,currentFloor:0,targetFloor:3,phase:'moving'}));
 assert.deepEqual(up.map(s=>s.floor),[0,1,2,3]);assert.match(up[1].primary,/1 · 5 Oct/);assert.match(up[1].secondary,/Ascending to 7 Oct · Floor 3/);
 const down=[18.6,12.4,6.2,0].map(height=>phiLiftIndicatorState({height,dates,currentFloor:3,targetFloor:0,phase:'moving'}));
 assert.deepEqual(down.map(s=>s.floor),[3,2,1,0]);assert.match(down[2].secondary,/Descending to Reception/);
 const idle=phiLiftIndicatorState({height:18.6,dates,currentFloor:3});assert.equal(idle.primary,'3 · 7 Oct');assert.equal(idle.secondary,'Archive lift');
 const drawing=[],context={clearRect(){},fillRect(){},fillText(text){drawing.push({text,font:this.font});}},display={canvas:{width:768,height:192},context,texture:{needsUpdate:false}};
 assert.equal(paintPhiLiftIndicator(display,up[1]),true);assert.ok(drawing.every(d=>d.font.includes('AlgoArt Marker')));assert.equal(display.texture.needsUpdate,true);
 assert.equal(paintPhiLiftIndicator(display,up[1]),false);assert.equal(paintPhiLiftIndicator(display,up[2]),true);
});
test('square writing mixes eight lettering forms, independent hands and lowercase phi in golden-angle groups',()=>{
 const objects=planPhiSquare(),marks=planSquareTags(objects);
 assert.equal(objects.filter(o=>o.kind==='wall').length,4);assert.equal(objects.filter(o=>o.kind==='monument').length,3);assert.equal(marks.length,85);
 assert.deepEqual(planSquareTags(objects),marks);assert.deepEqual(new Set(marks.map(m=>m.phrase)),new Set(['PHI','φ']));
 assert.deepEqual(new Set(marks.map(m=>m.form)),new Set(SQUARE_TAG_FORMS));assert.equal(SQUARE_TAG_FORMS.length,8);
 assert.ok(new Set(marks.map(m=>m.hand)).size>=25,'Writer identities are repeating');
 const faces=new Map();for(const m of marks){if(!faces.has(m.face.id))faces.set(m.face.id,[]);faces.get(m.face.id).push(m);}
 assert.deepEqual(new Set([...faces.values()].map(ms=>ms.length)),new Set(SQUARE_TAG_COUNTS));
 for(const group of faces.values()){
  if(group.length>=3){assert.ok(new Set(group.map(m=>m.form)).size>=3);assert.deepEqual(new Set(group.map(m=>m.phrase)),new Set(['PHI','φ']));}
  for(let i=1;i<group.length;i++)assert.ok(Math.abs(group[i].phi.angle-group[i-1].phi.angle-GOLDEN_ANGLE)<1e-12);
 }
 for(const m of marks){
  assert.equal(m.tag.version,7);assert.equal(m.text,m.phrase);assert.equal(m.tag.text,m.phrase);
  if(m.phrase==='φ')assert.equal(m.tag.construction.letters[0].character,'φ');
  const object=objects.find(o=>m.face.id.startsWith(o.id+':'));
  const hh=(Math.abs(m.height*Math.cos(m.rotation))+Math.abs(m.width*Math.sin(m.rotation)))/2;
  const hw=(Math.abs(m.width*Math.cos(m.rotation))+Math.abs(m.height*Math.sin(m.rotation)))/2;
  const right={x:m.normal.z,z:-m.normal.x};
  const u=(m.position.x-m.face.centre.x)*right.x+(m.position.z-m.face.centre.z)*right.z;
  assert.ok(m.position.y-hh>.05&&m.position.y+hh<object.height,'Paint leaves its wall vertically');
  assert.ok(Math.abs(u)+hw<m.face.length/2,'Paint leaves its wall horizontally');
 }
});
test('square objects leave the entrance, frontage benches and central route clear with rotated collisions',()=>{
 const objects=planPhiSquare();
 for(let z=-2;z<=25;z+=.25)for(const x of [-2,0,2])assert.ok(clearOfPhiSquare(objects,x,z),'Main route obstructed at '+x+','+z);
 for(const x of [-5.2,5.2])assert.ok(clearOfPhiSquare(objects,x,3.1,1.4),'Frontage seating obstructed');
 for(const p of objects){assert.equal(clearOfPhiSquare([p],p.x,p.z),false);assert.ok(Math.abs(p.x)<30&&p.z<41);}
 const diagonal={x:0,z:0,yaw:Math.PI/4,width:6,depth:.34};
 assert.equal(clearOfPhiSquare([diagonal],1,-1),false);assert.equal(clearOfPhiSquare([diagonal],1,1),true);
});
