// TEST ONLY: immutable, exact BufferGeometry room-floor/ceiling packages.
// Compiler runs in Node; browser decodes the same indexed vertices, normals,
// and UVs. Room-owned surfaces can swap without touching walls, art or lights.
import * as THREE from 'three';
import {ROOM_HEIGHT} from './layout-v2.mjs';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {chooseGalleryPenroseRooms,pieceRoomIndex} from './phi-gallery-penrose-floor.mjs';
import {alignReceptionTileUvs} from './reception-tile-preview.mjs';
import {tiledBoxUvs} from './architectural-materials.mjs';

export const PHI_ROOM_PACKAGE_VERSION=1;
export const PHI_ROOM_MATERIAL_TILING=Object.freeze({floor:2.25,penrose:2.25,plaster:2.2});

const round=v=>Number(Number(v).toFixed(7));
export function phiRoomPackageFingerprint(phi,date,elevation){
 return JSON.stringify({v:PHI_ROOM_PACKAGE_VERSION,date,elevation:round(elevation),
  pieces:phi.pieces.map(p=>[p.room,round(p.x),round(p.z),round(p.w),round(p.h)]),
  selected:chooseGalleryPenroseRooms(phi.floor.mergedRooms,date)});
}
function surface(box,material){
 const [w,h,d,x,y,z]=box;
 const geometry=new THREE.BoxGeometry(w,h,d);
 tiledBoxUvs(geometry,w,h,d,PHI_ROOM_MATERIAL_TILING[material]);
 if(material==='penrose')alignReceptionTileUvs({
  geometry,position:new THREE.Vector3(x,y,z),
  material:{userData:{tileMeters:PHI_ROOM_MATERIAL_TILING.penrose}}
 });
 geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(x,y,z));
 return geometry;
}
function packedGeometry(geometries){
 const merged=mergeGeometries(geometries,false);
 geometries.forEach(g=>g.dispose());
 if(!merged)throw Error('Unable to compile indexed room geometry');
 const attrs={};
 for(const key of ['position','normal','uv']){
  const attribute=merged.getAttribute(key);
  attrs[key]={size:attribute.itemSize,data:Array.from(attribute.array)};
 }
 const result={attrs,index:Array.from(merged.index.array),triangles:merged.index.count/3};
 merged.dispose();
 return result;
}
export function compilePhiRoomPackage(phi,date,elevation,room){
 if(date==='__phi_reception__')throw Error('Reception is not part of this test');
 if(!Number.isInteger(room)||room<0||room>=phi.floor.mergedRooms.length)
  throw RangeError('Unknown room');
 const penrose=new Set(chooseGalleryPenroseRooms(phi.floor.mergedRooms,date));
 const grouped=new Map();
 const add=(material,box)=>{
  if(!grouped.has(material))grouped.set(material,[]);
  grouped.get(material).push(surface(box,material));
 };
 let pieces=0;
 for(const p of phi.pieces){
  if(p.room!==room)continue;
  pieces++;
  const x=p.x+p.w/2,z=p.z+p.h/2;
  const selected=penrose.has(pieceRoomIndex(p,phi.floor.mergedRooms));
  add(selected?'penrose':'floor',[p.w,.28,p.h,x,elevation-.17,z]);
  add('plaster',[p.w,.18,p.h,x,elevation+ROOM_HEIGHT+.10,z]);
 }
 return {version:PHI_ROOM_PACKAGE_VERSION,date,elevation,room,
  fingerprint:phiRoomPackageFingerprint(phi,date,elevation),pieces,
  geometries:Object.fromEntries([...grouped].map(([name,parts])=>[name,packedGeometry(parts)]))};
}
export function decodePhiRoomPackage(THREE,pack,materials){
 if(pack?.version!==PHI_ROOM_PACKAGE_VERSION||!Number.isInteger(pack.room))throw Error('Invalid package');
 const meshes=[];
 try{
  for(const [key,data] of Object.entries(pack.geometries||{})){
   if(!Object.hasOwn(PHI_ROOM_MATERIAL_TILING,key)||!materials[key])throw Error('Unexpected material '+key);
   const geometry=new THREE.BufferGeometry();
   for(const [attr,{size,data:values}] of Object.entries(data.attrs)){
    if(!['position','normal','uv'].includes(attr))throw Error('Unexpected attribute');
    geometry.setAttribute(attr,new THREE.Float32BufferAttribute(values,size));
   }
   geometry.setIndex(data.index);
   geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const mesh=new THREE.Mesh(geometry,materials[key]);
   mesh.name='phi-precompiled-'+pack.room+'-'+key;
   meshes.push(mesh);
  }
  return meshes;
 }catch(error){meshes.forEach(mesh=>mesh.geometry.dispose());throw error;}
}
