import {TOWER_HANDS} from '../gallery/visit/tower-graffiti-styles.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildLayout,PHI} from '../gallery/visit/layout-v2.mjs';
import {planGalleryHangs} from '../gallery/visit/hanging-v3.mjs';
import {planInteriorGraffiti,interiorWallFaces,interiorGraffitiKey} from '../gallery/visit/interior-graffiti-plan.mjs';
import {planGraffitiAtlases} from '../gallery/visit/exterior-graffiti-plan.mjs';
import {graffitiGeometry} from '../gallery/visit/exterior-graffiti.mjs';
const floors=JSON.parse(fs.readFileSync('gallery/tower-layouts.json','utf8')).floors;
function exhibition(floor,level,mode='mixed'){
 const studies=floor.studies.map(([seed,engine],i)=>({id:'art-'+i,seed,engine,portrait:mode==='portrait'||mode==='mixed'&&i%2===0,aspect:mode==='landscape'||i%2?1.4:1/1.4}));
 const layout=buildLayout(floor.date,studies.length,studies),entry=layout.rooms[0];
 entry.liftWall=['north','east','south','west'].find(s=>!entry.doors.includes(s));
 if(level===0)entry.entranceWall=['south','east','west','north'].find(s=>s!==entry.liftWall&&!entry.doors.includes(s));
 return {layout,level,hangs:planGalleryHangs(layout,studies)};
}
test('every floor gets three to five small handstyles on painting-free wall faces',()=>{
 for(const [level,floor] of floors.entries())for(const mode of ['mixed','landscape','portrait']){
  const input=exhibition(floor,level,mode),marks=planInteriorGraffiti(input),art=new Set(input.hangs.map(h=>h.roomIndex+':'+h.surface));
  assert.ok(marks.length>=3&&marks.length<=5);assert.deepEqual(planInteriorGraffiti(input),marks);
  for(const m of marks){assert.ok(TOWER_HANDS.includes(m.hand));assert.equal(m.surface,'interior');assert.equal(m.form,'handstyle');assert.ok(!art.has(m.face.id));assert.ok(m.width<=1.35&&m.height<=.450001);assert.ok(m.width>0&&m.height>0);}
  assert.equal(new Set(marks.map(m=>m.hand)).size,marks.length,'Each floor must use a different A–Z writer');
  assert.ok(marks.every(m=>m.tag.renderer==='az-nine-v1'&&m.tag.version==='az-nine-v1-20261025'));
  const availableRooms=new Set(interiorWallFaces(input.layout,input.hangs).map(f=>f.roomIndex));
  assert.equal(new Set(marks.map(m=>m.face.roomIndex)).size,Math.min(availableRooms.size,marks.length));
  assert.ok(marks.some(m=>m.rotation<0)&&marks.some(m=>m.rotation>0));
 }
});
test('rotated tags stay in the reachable wall band and leave openings and each other clear',()=>{
 for(const [level,floor] of floors.entries()){
  const input=exhibition(floor,level),marks=planInteriorGraffiti(input);
  for(const m of marks){
   assert.ok(m.wallU-m.halfAlong>=m.face.lo-1e-8&&m.wallU+m.halfAlong<=m.face.hi+1e-8);
   assert.ok(m.centreY-m.halfUp>=.65-1e-8&&m.centreY+m.halfUp<=2.05+1e-8);
   if(m.face.opening)assert.ok(Math.abs(m.wallU)-m.halfAlong>=m.face.opening/2+.42-1e-8);
  }
  for(let i=0;i<marks.length;i++)for(let j=i+1;j<marks.length;j++)if(marks[i].face.id===marks[j].face.id){const a=marks[i],b=marks[j];assert.ok(Math.abs(a.wallU-b.wallU)>=a.halfAlong+b.halfAlong+.079||Math.abs(a.centreY-b.centreY)>=a.halfUp+b.halfUp+.079);}
 }
});
test('phi controls the actual usable-wall positions and angle variety',()=>{
 const input=exhibition(floors[0],0),marks=planInteriorGraffiti(input);
 for(const m of marks){
  const u=((m.phi.uIndex+1)/PHI)%1,v=((m.phi.vIndex+1)/PHI)%1;
  const expectedU=m.face.lo+m.halfAlong+(m.face.hi-m.face.lo-2*m.halfAlong)*u;
  const expectedY=.65+m.halfUp+(2.05-.65-2*m.halfUp)*v;
  assert.ok(Math.abs(m.wallU-expectedU)<1e-8&&Math.abs(m.centreY-expectedY)<1e-8);
  const projected=(m.position.x-m.face.centre.x)*m.normal.z-(m.position.z-m.face.centre.z)*m.normal.x;
  assert.ok(Math.abs(projected-expectedU)<1e-8);assert.ok(Math.abs(m.rotation)>.08&&Math.abs(m.rotation)<.37);
 }
 assert.ok(new Set(marks.map(m=>Math.abs(m.rotation))).size>=3);
});
test('a newly occupied painting wall is removed from the eligible tag surfaces',()=>{
 const input=exhibition(floors[0],0),first=planInteriorGraffiti(input)[0];
 const changed={...input,hangs:[...input.hangs,{roomIndex:first.face.roomIndex,surface:first.face.side}]};
 assert.notEqual(interiorGraffitiKey(changed),interiorGraffitiKey(input));
 assert.ok(planInteriorGraffiti(changed).every(m=>m.face.id!==first.face.id));
});
test('interior geometry faces into the room and remains flush with the plaster',()=>{
 const input=exhibition(floors[7],7),marks=planInteriorGraffiti(input),page=planGraffitiAtlases(marks)[0];
 const g=graffitiGeometry(THREE,page.entries,page.size,7,2.7,page.height),p=g.getAttribute('position');
 for(const [i,m] of marks.entries()){
  const room=input.layout.rooms[m.face.roomIndex],toRoom=new THREE.Vector3(room.x-m.face.centre.x,0,room.z-m.face.centre.z),normal=new THREE.Vector3(m.normal.x,0,m.normal.z);
  assert.ok(toRoom.dot(normal)>0);
  const a=new THREE.Vector3().fromBufferAttribute(p,i*4),b=new THREE.Vector3().fromBufferAttribute(p,i*4+1),c=new THREE.Vector3().fromBufferAttribute(p,i*4+2);
  assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).normalize().dot(normal)>.9999);
  const centre=new THREE.Vector3();for(let k=0;k<4;k++)centre.add(new THREE.Vector3().fromBufferAttribute(p,i*4+k));centre.multiplyScalar(.25);
  assert.ok(Math.abs(centre.sub(new THREE.Vector3(m.position.x,m.position.y,m.position.z)).dot(normal)-.173)<1e-5);
 }
 g.dispose();
});

test('new indoor floor seeds never require a default font or older writer masks',()=>{
 const expected=new Set(TOWER_HANDS);
 for(const [level,floor] of floors.entries()){
  const {layout,hangs}=exhibition(floor,level);
  const tags=planInteriorGraffiti({layout,hangs,level});
  for(const mark of tags){
   assert.ok(expected.has(mark.hand));assert.equal(mark.tag.family,mark.hand);
   assert.ok(mark.tag.plan.letters.every(l=>l.glyph.shapes.length>0));
  }
 }
});
