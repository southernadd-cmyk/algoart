// TEST ONLY. Multiple meshes reuse the same physical material on the gallery
// walls, floors, ceilings and frames. Assigning receiveShadow is per-object;
// requesting a shader recompile for every mesh sharing that material is not.
// With the A/B flag enabled, invalidate each material only the first time a
// newly shadow-receiving object uses it. Source shader code remains unchanged.
export function createPhiShadowReceiverMarker({reuse=false}={}){
 const invalidated=new WeakSet();
 const stats={enabled:!!reuse,receivers:0,invalidations:0,skippedInvalidations:0};
 function mark(mesh){
  if(!mesh||mesh.receiveShadow)return false;
  mesh.receiveShadow=true;
  stats.receivers++;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const material of materials){
   if(!material)continue;
   if(reuse&&invalidated.has(material)){stats.skippedInvalidations++;continue;}
   material.needsUpdate=true;
   stats.invalidations++;
   invalidated.add(material);
  }
  return true;
 }
 return {mark,stats};
}
