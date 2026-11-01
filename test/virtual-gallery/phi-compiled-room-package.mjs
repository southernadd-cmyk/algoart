// TEST ONLY: immutable, exact BufferGeometry room-floor/ceiling packages.
// Compiler runs in Node; browser decodes the same indexed vertices, normals,
// and UVs. Room-owned surfaces can swap without touching walls, art or lights.
import * as THREE from 'three';
import {ROOM_HEIGHT} from './layout-v2.mjs';
import {receptionWindowWallParts} from './phi-reception-window.mjs';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {chooseGalleryPenroseRooms,pieceRoomIndex} from './phi-gallery-penrose-floor.mjs';
import {alignReceptionTileUvs} from './reception-tile-preview.mjs';
import {tiledBoxUvs} from './architectural-materials.mjs';

export const PHI_ROOM_PACKAGE_VERSION=1;
export const PHI_ROOM_MATERIAL_TILING=Object.freeze({floor:2.25,penrose:2.25,plaster:2.2,brick:1.05,trims:.8,plinth:1.15});

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
 if(pack?.version!==PHI_ROOM_PACKAGE_VERSION&&pack?.version!==1)throw Error('Invalid package version');
 if(!Number.isInteger(pack.room)&&pack.scope!=='shared')throw Error('Invalid package');
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
   mesh.name='phi-precompiled-'+(pack.scope==='shared'?'shared':pack.room)+'-'+key;
   meshes.push(mesh);
  }
  return meshes;
 }catch(error){meshes.forEach(mesh=>mesh.geometry.dispose());throw error;}
}

// Static architecture common to every room: complete solid walls, outer brick
// veneer, cornices and skirtings. Doors, glass, shadows, signs and lighting
// remain independent. These boxes are the very same as constructPhiGallery.
export function compilePhiSharedArchitecture(phi,date,elevation){
 if(date==='__phi_reception__')throw Error('Reception is not a compiled test floor');
 const grouped=new Map();
 const add=(material,box)=>{
  if(!grouped.has(material))grouped.set(material,[]);
  grouped.get(material).push(surface(box,material));
 };
 let wallBoxes=0,veneerBoxes=0,trimBoxes=0;
 for(const w of phi.physical.walls)for(const part of receptionWindowWallParts(w,null,ROOM_HEIGHT)){
  const len=part.hi-part.lo;
  if(len<.04)continue;
  const centre=(part.lo+part.hi)/2,centreY=elevation+part.bottom+part.height/2;
  add('plaster',w.axis==='x'
   ?[.19,part.height,len,w.at,centreY,centre]
   :[len,part.height,.19,centre,centreY,w.at]);
  wallBoxes++;
 }
 const inCell=(x,z)=>phi.pieces.some(p=>x>=p.x-.0001&&x<=p.x+p.w+.0001&&
  z>=p.z-.0001&&z<=p.z+p.h+.0001);
 for(const w of phi.physical.walls)for(const part of receptionWindowWallParts(w,null,ROOM_HEIGHT)){
  const len=part.hi-part.lo;
  if(len<.05)continue;
  const c=(part.lo+part.hi)/2,offset=.24,centreY=elevation+part.bottom+part.height/2;
  if(w.axis==='x'){
   const left=inCell(w.at-offset,c),right=inCell(w.at+offset,c);
   if(left===right)continue;
   const side=left?1:-1;
   add('brick',[.035,part.height,len,w.at+side*.113,centreY,c]);
  }else{
   const north=inCell(c,w.at-offset),south=inCell(c,w.at+offset);
   if(north===south)continue;
   const side=north?1:-1;
   add('brick',[len,part.height,.035,c,centreY,w.at+side*.113]);
  }
  veneerBoxes++;
 }
 for(const w of phi.physical.walls){
  const len=w.hi-w.lo;if(len<.45)continue;
  if(w.axis==='x'){
   add('trims',[.13,.16,len,w.at,elevation+ROOM_HEIGHT-.035,(w.lo+w.hi)/2]);
   add('plinth',[.065,.13,len,w.at,elevation+.14,(w.lo+w.hi)/2]);
  }else{
   add('trims',[len,.16,.13,(w.lo+w.hi)/2,elevation+ROOM_HEIGHT-.035,w.at]);
   add('plinth',[len,.13,.065,(w.lo+w.hi)/2,elevation+.14,w.at]);
  }
  trimBoxes+=2;
 }
 return {version:PHI_ROOM_PACKAGE_VERSION,date,elevation,scope:'shared',
  fingerprint:phiRoomPackageFingerprint(phi,date,elevation),
  wallBoxes,veneerBoxes,trimBoxes,
  geometries:Object.fromEntries([...grouped].map(([name,parts])=>[name,packedGeometry(parts)]))};
}
