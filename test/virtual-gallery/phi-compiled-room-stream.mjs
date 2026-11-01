// TEST ONLY. Room surfaces are compiled offline into real vertex/index buffers.
// A missing, stale or corrupt package never removes the original architecture.
// Only the matching room's mesh tree is swapped after exact geometry parity.
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {phiRoomPackageFingerprint,decodePhiRoomPackage}
 from './phi-compiled-room-package.mjs';

function geometryMatchesFallback(records,compiled){
 const batches=new Map();
 for(const {mesh,key} of records){
  if(!batches.has(key))batches.set(key,[]);
  mesh.updateMatrix();
  batches.get(key).push(mesh.geometry.clone().applyMatrix4(mesh.matrix));
 }
 try{
  for(const [key,originals] of batches){
   const packed=mergeGeometries(originals,false);
   const replacement=compiled.find(m=>m.name.endsWith('-'+key));
   if(!packed||!replacement)return false;
   for(const attr of ['position','normal','uv']){
    const a=packed.getAttribute(attr)?.array,b=replacement.geometry.getAttribute(attr)?.array;
    if(!a||!b||a.length!==b.length)return false;
    for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;
   }
   const a=packed.index?.array,b=replacement.geometry.index?.array;
   if(!a||!b||a.length!==b.length)return false;
   for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;
   packed.dispose();
  }
  return compiled.length===batches.size;
 }finally{
  for(const gs of batches.values())for(const g of gs)g.dispose();
 }
}
export async function preparePhiCompiledRoomStream(THREE,{date,phi,elevation,
 enabled=false,stream=true,fetchJson=null}={}){
 if(!enabled||date==='__phi_reception__')return null;
 const load=fetchJson|| (async url=>{
  const response=await fetch(url,{cache:'force-cache'});
  if(!response.ok)throw Error('Precompiled room package HTTP '+response.status);
  return response.json();
 });
 const base=new URL('./precompiled/'+date+'/',import.meta.url);
 const fingerprint=phiRoomPackageFingerprint(phi,date,elevation);
 let manifest;
 try{
  manifest=await load(new URL('manifest.json',base));
  if(manifest?.version!==1||manifest.date!==date||manifest.elevation!==elevation||
     manifest.fingerprint!==fingerprint||manifest.roomCount!==phi.floor.mergedRooms.length||
     !Array.isArray(manifest.rooms)||manifest.rooms.length!==manifest.roomCount)
   throw Error('Precompiled room fingerprint or count mismatch');
 }catch(error){
  console.warn('[TEST compiled rooms] Falling back to original architecture:',error);
  return null;
 }
 const packages=new Map(),requests=new Map(),roots=new Map();
 const stats={date,active:true,stream,valid:0,failed:0,loaded:0,replaced:0,directRooms:0,
  bytes:0,originalMeshesDisposed:0,parityFailures:0,requestedRooms:[],fallbackRooms:[]};
 let cancelled=false;
 const request=room=>{
  if(cancelled||!Number.isInteger(room)||room<0||room>=manifest.roomCount)return Promise.resolve(null);
  if(requests.has(room))return requests.get(room);
  const info=manifest.rooms.find(r=>r.room===room);
  if(!info||!/^room-[0-9]+\.json$/.test(info.url))return Promise.resolve(null);
  stats.requestedRooms.push(room);
  const pending=load(new URL(info.url,base)).then(pack=>{
   if(cancelled)return null;
   if(pack?.version!==1||pack.date!==date||pack.elevation!==elevation||
      pack.fingerprint!==fingerprint||pack.room!==room||pack.pieces!==info.pieces)
    throw Error('Invalid room package '+room);
   packages.set(room,pack);
   stats.loaded++;stats.bytes+=info.bytes||0;
   const rec=roots.get(room);
   if(rec)swap(room,rec,pack);
   return pack;
  }).catch(error=>{
   if(!cancelled){stats.failed++;console.warn('[TEST compiled rooms] Keeping original room '+room,error);}
   return null;
  });
  requests.set(room,pending);
  return pending;
 };
 const swap=(room,rec,pack)=>{
  if(cancelled||rec.swapped||!rec.root.parent)return false;
  const replacements=decodePhiRoomPackage(THREE,pack,rec.materials);
  if(!geometryMatchesFallback(rec.records,replacements)){
   replacements.forEach(mesh=>mesh.geometry.dispose());
   stats.parityFailures++;console.warn('[TEST compiled rooms] Geometry differs, preserving originals:',room);
   return false;
  }
  for(const {mesh} of rec.records){
   rec.root.remove(mesh);
   mesh.geometry.dispose();
   stats.originalMeshesDisposed++;
  }
  for(const mesh of replacements)rec.root.add(mesh);
  rec.swapped=true;stats.replaced++;
  return true;
 };
 const attach=(room,root,records,materials)=>{
  if(cancelled||!root?.parent||!Array.isArray(records))return false;
  if(!records.length){
   const pack=packages.get(room);
   if(!pack)return false;
   const meshes=decodePhiRoomPackage(THREE,pack,materials);
   for(const mesh of meshes)root.add(mesh);
   roots.set(room,{root,records,materials,swapped:true});
   stats.replaced++;stats.directRooms++;
   return true;
  }
  const rec={root,records,materials,swapped:false};
  roots.set(room,rec);
  const pack=packages.get(room);
  if(pack)swap(room,rec,pack);
  else stats.fallbackRooms.push(room);
  return true;
 };
 // First room is next to the lift. Other rooms are requested as the visitor
 // reaches them; the original walls/floors remain available at all times.
 if(stream)await request(0);
 else await Promise.all(manifest.rooms.map(({room})=>request(room)));
 const session={manifest,stats:()=>({...stats,remaining:manifest.roomCount-stats.replaced}),
  getPack:room=>packages.get(room)||null,attach,request,
  // Keep the original geometry if the room packet has not arrived yet.
  cancel:()=>{cancelled=true;roots.clear();requests.clear();packages.clear();},
  get active(){return !cancelled;}
 };
 return session;
}
