import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {planPhiSquare,planSquareTags} from '../gallery/visit/phi-square-graffiti.mjs';
import {planSquareWallAtlases} from '../gallery/visit/square-graffiti-atlas.mjs';
import {graffitiGeometry} from '../gallery/visit/exterior-graffiti.mjs';

for(const variant of ['live','test'])test(variant+' walls spread all four paint tiers across the face',()=>{
 globalThis.__phiReceptionTestRefresh=variant==='test';
 const objects=planPhiSquare(),marks=planSquareTags(objects);
 assert.equal(marks.length,187);
 for(const object of objects.filter(o=>o.kind==='wall'))for(const side of [0,1]){
  const group=marks.filter(m=>m.face.id===object.id+':'+side);
  assert.equal(group.length,17);
  assert.deepEqual([group.slice(0,1).length,group.slice(1,4).length,group.slice(4,9).length,group.slice(9).length],[1,3,5,8]);
  const along=[],up=[];
  for(const mark of group){
   const n=mark.normal,right={x:n.z,z:-n.x};
   const dx=mark.position.x-mark.face.centre.x,dz=mark.position.z-mark.face.centre.z;
   assert.ok(Math.abs(dx*n.x+dz*n.z)<1e-10,'Paint tier moved behind its wall');
   const u=dx*right.x+dz*right.z,c=Math.abs(Math.cos(mark.rotation)),s=Math.abs(Math.sin(mark.rotation));
   assert.ok(Math.abs(u)+(mark.width*c+mark.height*s)/2<=object.width/2-.119);
   assert.ok(mark.position.y-(mark.height*c+mark.width*s)/2>=.119);
   assert.ok(mark.position.y+(mark.height*c+mark.width*s)/2<=object.height-.119);
   along.push(u);up.push(mark.position.y);
  }
  assert.ok(Math.max(...along)-Math.min(...along)>object.width*.68,'Paint clustered horizontally');
  assert.ok(Math.max(...up)-Math.min(...up)>object.height*.60,'Paint clustered vertically');
  assert.ok(group.slice(9).every(m=>m.form==='handstyle'));
 }
});

test('wall atlases composite each face once, with stable size order and isolated gutters',()=>{
 globalThis.__phiReceptionTestRefresh=false;
 const marks=planSquareTags();
 for(const lowPower of [false,true])for(const material of ['brick','concrete']){
  const subset=marks.filter(m=>m.material===material),pages=planSquareWallAtlases(subset,{lowPower});
  assert.deepEqual(pages,planSquareWallAtlases(subset,{lowPower}));
  const entries=pages.flatMap(p=>p.entries);
  assert.equal(entries.length,new Set(subset.map(m=>m.face.id)).size);
  assert.equal(entries.reduce((n,e)=>n+e.mark.markCount,0),subset.length);
  for(const page of pages){
   assert.ok(page.height<=page.size);
   for(const e of page.entries){
    assert.ok(e.x>=8&&e.y>=8&&e.x+e.width<=page.size-8&&e.y+e.height<=page.height-8);
    assert.equal(e.mark.surface,'square');assert.equal(e.mark.rotation,0);
    assert.deepEqual(e.mark.tag.layers,subset.filter(m=>m.face.id===e.mark.face.id));
    for(const other of page.entries.filter(o=>o!==e))assert.ok(e.x+e.width+8<=other.x||other.x+other.width+8<=e.x||e.y+e.height+8<=other.y||other.y+other.height+8<=e.y);
   }
  }
 }
});

test('all baked wall vertices stay outside the actual rotated masonry at every tower floor',()=>{
 for(const variant of [false,true]){
  globalThis.__phiReceptionTestRefresh=variant;
  const marks=planSquareTags();
  for(const currentFloor of [0,1,9])for(const page of planSquareWallAtlases(marks)){
   const geometry=graffitiGeometry(THREE,page.entries,page.size,currentFloor,2,page.height),positions=geometry.getAttribute('position');
   for(const [i,{mark}] of page.entries.entries())for(let k=0;k<4;k++){
    const x=positions.getX(i*4+k)-mark.face.centre.x,z=positions.getZ(i*4+k)-mark.face.centre.z;
    assert.ok(Math.abs(x*mark.normal.x+z*mark.normal.z-.008)<1e-5,'Paint intersects brick');
   }
   geometry.dispose();
  }
 }
 globalThis.__phiReceptionTestRefresh=false;
});
