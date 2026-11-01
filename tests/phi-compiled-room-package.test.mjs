import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildPhiRendererPlan} from '../test/virtual-gallery/phi-full-engine-adapter.mjs';
import {chooseGalleryPenroseRooms,pieceRoomIndex} from '../test/virtual-gallery/phi-gallery-penrose-floor.mjs';
import {alignReceptionTileUvs} from '../test/virtual-gallery/reception-tile-preview.mjs';
import {tiledBoxUvs} from '../test/virtual-gallery/architectural-materials.mjs';
import {ROOM_HEIGHT} from '../test/virtual-gallery/layout-v2.mjs';
import {compilePhiRoomPackage,decodePhiRoomPackage,phiRoomPackageFingerprint}
 from '../test/virtual-gallery/phi-compiled-room-package.mjs';
import {preparePhiCompiledRoomStream} from '../test/virtual-gallery/phi-compiled-room-stream.mjs';

const date='2026-10-20';
const meta=JSON.parse(readFileSync(new URL('../gallery/'+date+'/meta.json',import.meta.url),'utf8'));
const archive=JSON.parse(readFileSync(new URL('../gallery/tower-layouts.json',import.meta.url),'utf8'));
const floorIndex=archive.floors.findIndex(f=>f.date===date)+1;
const elevation=floorIndex*6.2;
const studies=meta.entries.map((e,i)=>({id:i,portrait:e.orientation==='portrait',
 aspect:e.orientation==='portrait'?1000/1400:1400/1000,
 material:e.material||'marker',engine:e.mode||'field',title:e.title||''}));
const phi=buildPhiRendererPlan(date,studies);
function originalRoomMeshes(room){
 const out=[];
 const selectedRooms=new Set(chooseGalleryPenroseRooms(phi.floor.mergedRooms,date));
 for(const p of phi.pieces){
  if(p.room!==room)continue;
  const x=p.x+p.w/2,z=p.z+p.h/2;
  const selected=selectedRooms.has(pieceRoomIndex(p,phi.floor.mergedRooms));
  for(const [key,dim,pos] of [
   [selected?'penrose':'floor',[p.w,.28,p.h],[x,elevation-.17,z]],
   ['plaster',[p.w,.18,p.h],[x,elevation+ROOM_HEIGHT+.10,z]]
  ]){
   const tile=key==='plaster'?2.2:2.25;
   const geometry=tiledBoxUvs(new THREE.BoxGeometry(...dim),...dim,tile);
   const material=new THREE.MeshBasicMaterial();material.userData.tileMeters=tile;
   const mesh=new THREE.Mesh(geometry,material);
   mesh.position.set(...pos);
   if(key==='penrose')alignReceptionTileUvs(mesh);
   out.push({key,mesh});
  }
 }
 return out;
}
function exactArrays(a,b){
 assert.deepEqual(Array.from(a.index.array),Array.from(b.index.array));
 for(const key of ['position','normal','uv'])
  assert.deepEqual(Array.from(a.getAttribute(key).array),Array.from(b.getAttribute(key).array),key);
}
test('compiled archive matches original room meshes including Penrose UVs, bit-for-bit',()=>{
 assert.equal(phi.floor.mergedRooms.length,4);
 const materials={floor:new THREE.MeshStandardMaterial(),penrose:new THREE.MeshStandardMaterial(),
  plaster:new THREE.MeshStandardMaterial()};
 for(let room=0;room<phi.floor.mergedRooms.length;room++){
  const pkg=compilePhiRoomPackage(phi,date,elevation,room);
  const meshes=decodePhiRoomPackage(THREE,pkg,materials);
  const original=originalRoomMeshes(room);
  for(const key of new Set(original.map(x=>x.key))){
   const parts=original.filter(x=>x.key===key).map(({mesh})=>{
    mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);
   });
   const expected=mergeGeometries(parts,false);
   const actual=meshes.find(m=>m.name==='phi-precompiled-'+room+'-'+key);
   assert.ok(actual,room+' '+key+' compiled');
   exactArrays(expected,actual.geometry);
   expected.dispose();parts.forEach(g=>g.dispose());
  }
  assert.equal(pkg.fingerprint,phiRoomPackageFingerprint(phi,date,elevation));
  original.forEach(({mesh})=>{mesh.geometry.dispose();mesh.material.dispose()});
  meshes.forEach(m=>m.geometry.dispose());
 }
 Object.values(materials).forEach(m=>m.dispose());
});
test('manifest matches the offline compiler and rejects stale geometry',()=>{
 const base=new URL('../test/virtual-gallery/precompiled/'+date+'/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
 assert.equal(manifest.fingerprint,phiRoomPackageFingerprint(phi,date,elevation));
 assert.equal(manifest.roomCount,phi.floor.mergedRooms.length);
 for(const entry of manifest.rooms){
  const pkg=JSON.parse(readFileSync(new URL(entry.url,base),'utf8'));
  assert.equal(pkg.fingerprint,manifest.fingerprint);
  assert.equal(pkg.room,entry.room);
 }
});
test('room 0 bypasses BoxGeometry and room 1 swaps only after exact parity',async()=>{
 const base=new URL('../test/virtual-gallery/precompiled/'+date+'/',import.meta.url);
 const read=async url=>JSON.parse(readFileSync(new URL(url.pathname.split('/').pop(),base),'utf8'));
 const stream=await preparePhiCompiledRoomStream(THREE,{date,phi,elevation,enabled:true,stream:true,fetchJson:read});
 assert.equal(stream.getPack(0)?.room,0);
 assert.equal(stream.getPack(1),null);
 const scene=new THREE.Scene();
 const materials={floor:new THREE.MeshStandardMaterial(),penrose:new THREE.MeshStandardMaterial(),
  plaster:new THREE.MeshStandardMaterial()};
 const preloaded=new THREE.Group();scene.add(preloaded);
 assert.equal(stream.attach(0,preloaded,[],materials),true);
 assert.equal(stream.stats().directRooms,1);
 const other=new THREE.Group();scene.add(other);
 const original=originalRoomMeshes(1);
 for(const {mesh} of original)other.add(mesh);
 assert.equal(stream.attach(1,other,original,materials),true);
 assert.equal(stream.stats().replaced,1);
 await stream.request(1);
 assert.equal(stream.stats().replaced,2);
 assert.equal(stream.stats().parityFailures,0);
 assert.ok(other.children.every(mesh=>mesh.name.startsWith('phi-precompiled-')));
 assert.equal(stream.stats().originalMeshesDisposed,original.length);
 stream.cancel();
 for(const root of [preloaded,other])root.traverse(obj=>obj.geometry?.dispose?.());
 Object.values(materials).forEach(m=>m.dispose());
});
