import {TOWER_HANDS} from '../gallery/visit/tower-graffiti-styles.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildLayout,ROOM_HEIGHT} from '../gallery/visit/layout-v2.mjs';
import {GRAFFITI_WORDS,WALL_MARGIN,planExteriorGraffiti,planGraffitiAtlases,reservedWalls,towerGraffitiKey} from '../gallery/visit/exterior-graffiti-plan.mjs';
import {graffitiGeometry,graffitiPaintParts} from '../gallery/visit/exterior-graffiti.mjs';
import {createTag,strokeFraction} from '../test/graffiti/tag-engine.mjs?v=sprayed-throwups-v7';
const source=JSON.parse(fs.readFileSync('gallery/tower-layouts.json','utf8'));
const floors=source.floors.map((f,level)=>({level,plan:buildLayout(f.date,f.studies.length,f.studies.map(([seed,engine])=>({seed,engine})))}));
const marks=planExteriorGraffiti(floors);
test('ground and first floors each have ten marks including distinct front freehands',()=>{
 assert.deepEqual(planExteriorGraffiti(floors),marks);
 for(const floor of floors){const tags=marks.filter(m=>m.date===floor.plan.date);assert.equal(tags.length,floor.level<2?10:0);if(floor.level<2){for(const phrase of GRAFFITI_WORDS)assert.ok(tags.some(t=>t.phrase===phrase));}}
 assert.deepEqual(new Set(marks.map(m=>m.phrase)),new Set(GRAFFITI_WORDS));
 assert.equal(marks.length,20);assert.ok(marks.some(m=>m.level===0));assert.ok(marks.some(m=>m.level===1));assert.ok(marks.every(m=>m.level<2));
 for(const level of [0,1]){
  const originals=marks.filter(m=>m.level===level&&m.slot<5),added=marks.filter(m=>m.level===level&&m.slot>=5);
  assert.equal(added.length,5);assert.ok(added.every(m=>m.form==='handstyle'));
  assert.equal(new Set(added.map(m=>m.hand)).size,5);
  assert.ok(added.every(m=>TOWER_HANDS.includes(m.hand)));
  assert.ok(originals.every(m=>TOWER_HANDS.includes(m.hand)));
  assert.equal(new Set([...originals,...added].map(m=>m.id)).size,10);
 }
 assert.ok(marks.every(m=>m.form==='handstyle'&&m.tag.renderer==='az-nine-v1'));
 for(const level of [0,1]){
  const visible=marks.filter(m=>m.level===level);
  assert.equal(new Set(visible.map(m=>m.hand)).size,9,'All nine complete alphabets must be represented before a repeat');
 }
});
test('paint fits solid wall faces and stays clear of doors, lifts, corners and roof bands',()=>{
 for(const mark of marks){
  const room=floors[mark.level].plan.rooms[mark.face.roomIndex];
  assert.ok(!room.doors.includes(mark.face.side));assert.ok(!reservedWalls(room,mark.level===0).includes(mark.face.side));
  const c=Math.abs(Math.cos(mark.rotation)),s=Math.abs(Math.sin(mark.rotation));
  const halfW=(mark.width*c+mark.height*s)/2,halfH=(mark.height*c+mark.width*s)/2;
  const along=Math.abs((mark.position.x-mark.face.centre.x)*mark.normal.z-(mark.position.z-mark.face.centre.z)*mark.normal.x);
  assert.ok(along+halfW<=mark.face.length/2-WALL_MARGIN+1e-7);
  const y=mark.position.y-mark.level*6.2-room.y;assert.ok(y-halfH>=.65-1e-7&&y+halfH<=ROOM_HEIGHT-.55+1e-7);
 }
});
test('new floors and occupied-floor room heights do not reshuffle existing writing',()=>{
 assert.deepEqual(planExteriorGraffiti(floors.slice(0,-1)),marks.filter(m=>m.level<floors.length-1));
 const active=7,elevation=active*6.2;
 const normalised=floors.map(f=>f.level!==active?f:{...f,plan:{...f.plan,rooms:f.plan.rooms.map(r=>({...r,y:Math.round(((r.y+elevation)-elevation)*1e6)/1e6,liftWall:'reserved'}))}});
 assert.equal(towerGraffitiKey(normalised),towerGraffitiKey(floors));assert.deepEqual(planExteriorGraffiti(normalised),marks);
});
test('atlas slots preserve tag aspect, have clear gutters and use shared pages',()=>{
 for(const lowPower of [false,true]){
  const pages=planGraffitiAtlases(marks,{lowPower});assert.equal(pages.length,Math.ceil(marks.length/32));
  for(const page of pages)for(const e of page.entries){assert.ok(e.x>=12&&e.y>=12&&e.x+e.width<=page.size-12&&e.y+e.height<=page.height-12);assert.ok(Math.abs(e.width/e.height-e.mark.bounds.width/e.mark.bounds.height)<1e-8);}
  assert.ok(pages.at(-1).height<=pages.at(-1).size);
 }
});
test('smaller paint steps retain each stroke’s seed, geometry and exact reveal timing',()=>{
 for(const form of ['hollow','bubble']){
  const tag=createTag('Proportion Piece',{form,hand:'kadism'}),parts=graffitiPaintParts(tag);let offset=0;
  assert.equal(parts.length,tag.construction.letters.length);assert.deepEqual(parts.flatMap(p=>p.strokes),tag.strokes);
  for(const part of parts){assert.equal(part.seed,tag.seed);assert.deepEqual(part.bounds,tag.bounds);
   for(let i=0;i<part.strokes.length;i++)for(const progress of [.2,.6,1])assert.equal(strokeFraction(part,i,progress),strokeFraction(tag,offset+i,progress));
   offset+=part.strokes.length;
  }
 }
});
test('batched quads face outward and use the same wall location for active, prepared and fallback floors',()=>{
 const page=planGraffitiAtlases(marks)[0],active=0;
 for(const currentFloor of [active,9]){
  const g=graffitiGeometry(THREE,page.entries,page.size,currentFloor,2,page.height),p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
  assert.equal(p.count,page.entries.length*4);assert.equal(g.index.count,page.entries.length*6);
  page.entries.forEach(({mark},i)=>{
   const a=new THREE.Vector3().fromBufferAttribute(p,i*4),b=new THREE.Vector3().fromBufferAttribute(p,i*4+1),c=new THREE.Vector3().fromBufferAttribute(p,i*4+2);
   const normal=new THREE.Vector3(mark.normal.x,0,mark.normal.z),cross=b.clone().sub(a).cross(c.clone().sub(a)).normalize();assert.ok(cross.dot(normal)>.9999);
   const centre=new THREE.Vector3();for(let k=0;k<4;k++)centre.add(new THREE.Vector3().fromBufferAttribute(p,i*4+k));centre.multiplyScalar(.25);
   const distance=centre.clone().sub(new THREE.Vector3(mark.position.x,mark.position.y,mark.position.z)).dot(normal);
   assert.ok(Math.abs(distance-(mark.level===currentFloor?.202:.173))<1e-5);
   for(let k=0;k<4;k++){assert.equal(n.getX(i*4+k),normal.x);assert.equal(n.getZ(i*4+k),normal.z);assert.ok(uv.getX(i*4+k)>=0&&uv.getX(i*4+k)<=1&&uv.getY(i*4+k)>=0&&uv.getY(i*4+k)<=1);}
  });g.dispose();
 }
});

test('all exterior graffiti is composed from authored nine-style glyphs',()=>{
 for(const mark of marks){
  assert.ok(mark.hand>='A'&&mark.hand<='I');
  assert.equal(mark.tag.version,'az-nine-v1-20261025');
  assert.equal(mark.tag.renderer,'az-nine-v1');
  assert.ok(mark.tag.plan.letters.length>0);
  assert.ok(mark.tag.plan.letters.every(x=>x.glyph.shapes.length>=1));
  assert.ok(mark.bounds.width>0&&mark.bounds.height===189);
 }
});
