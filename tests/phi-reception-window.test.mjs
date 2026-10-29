import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import * as THREE from 'three';
import {planPhiReceptionWindow,receptionWindowWallParts,createReceptionWindowMasonryGeometry,RECEPTION_WINDOW_PITCH,RECEPTION_WINDOW_BORDER} from '../gallery/visit/phi-reception-window.mjs';
const studies=Array.from({length:10},(_,i)=>({id:String(i),portrait:i%3===0,aspect:1.4}));
const p=buildPhiRendererPlan('__phi_reception__',studies);
const window=planPhiReceptionWindow(p.circulation.publicEntrance);
test('three evenly spaced windows and their borders fit the foyer and clear the entrance',()=>{
 assert.equal(window.windows.length,3);
 const door=p.circulation.publicEntrance;
 const front=p.pieces.filter(c=>Math.abs(c.z-door.at)<.001&&c.room===0);
 const minX=Math.min(...front.map(c=>c.x)),maxX=Math.max(...front.map(c=>c.x+c.w));
 for(const [i,bay] of window.windows.entries()){
  assert.ok(bay.x-bay.width/2-RECEPTION_WINDOW_BORDER>minX);
  assert.ok(bay.x+bay.width/2+RECEPTION_WINDOW_BORDER<maxX);
  assert.ok(Math.abs(bay.x-door.centre)>(bay.width+door.width)/2+1);
  assert.equal(p.canWalk(bay.x,bay.at),false,'Window cannot become a walk-through doorway');
  if(i)assert.ok(Math.abs(bay.x-window.windows[i-1].x-RECEPTION_WINDOW_PITCH)<1e-8);
 }
 assert.ok(window.sill>.7&&window.sill+window.height+.4<5.2);
});
test('all three apertures remain open across wall segment boundaries in both wall layers',()=>{
 const walls=p.physical.walls.filter(w=>w.axis==='z'&&w.at===window.at);
 const parts=walls.flatMap(w=>receptionWindowWallParts(w,window,5.2));
 const area=parts.reduce((sum,q)=>sum+(q.hi-q.lo)*q.height,0);
 const wallArea=walls.reduce((sum,w)=>sum+(w.hi-w.lo)*5.2,0);
 assert.ok(Math.abs(area-(wallArea-3*window.width*window.height))<1e-8);
 for(const bay of window.windows)for(const y of [bay.sill+.05,bay.sill+bay.height/2,bay.sill+bay.height-.05])
  assert.ok(!parts.some(q=>bay.x>q.lo&&bay.x<q.hi&&y>q.bottom&&y<q.bottom+q.height));
 const plain={axis:'x',at:window.at,lo:-5,hi:5};
 assert.deepEqual(receptionWindowWallParts(plain,window),[{lo:-5,hi:5,bottom:0,height:5.2}]);
});
test('jointed masonry surrounds the arch without crossing the central glazing',()=>{
 const geo=createReceptionWindowMasonryGeometry(THREE);
 const box=geo.boundingBox;
 assert.ok(box.min.x<-window.width/2-.22&&box.max.x>window.width/2+.22);
 assert.ok(box.max.y>window.height+.2&&box.max.y<window.height+.45);
 const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++)assert.ok(Number.isFinite(pos.getX(i))&&Number.isFinite(pos.getY(i))&&Number.isFinite(pos.getZ(i)));
 // A ray through the central glass must miss every surrounding masonry block.
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 mesh.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(0,1,2),new THREE.Vector3(0,0,-1));
 assert.equal(ray.intersectObject(mesh).length,0);
 geo.dispose();mesh.material.dispose();
});
test('optimised scan retains attribution, photographic maps and a bounded mesh without a decoder dependency',()=>{
 const b=readFileSync(new URL('../gallery/visit/models/reception-church-window.glb',import.meta.url));
 assert.ok(b.length<1.2*1024*1024);assert.equal(b.readUInt32LE(8),b.length);
 const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 assert.match(j.asset.extras.author,/MWOgier/);assert.match(j.asset.extras.license,/CC-BY-4.0/);
 assert.equal(j.images.length,2);assert.ok(!j.extensionsRequired?.length);
 const tris=j.meshes.flatMap(m=>m.primitives).reduce((n,q)=>n+j.accessors[q.indices].count/3,0);
 assert.ok(tris<15000&&tris>1000);
 const positions=j.meshes.flatMap(m=>m.primitives).map(q=>j.accessors[q.attributes.POSITION]);
 assert.ok(Math.max(...positions.map(a=>a.max[1]))<=window.height+.0001);
 assert.ok(Math.min(...positions.map(a=>a.min[1]))>=-.0001);
});
