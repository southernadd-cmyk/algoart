import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Merge only explicitly registered, immovable architectural meshes. Copy the
// original vertex/normal/UV buffers so uploaded tiles keep their exact mapping.
// Doors, props, lights, glass and asynchronously replaced fallbacks stay separate.
export function batchPhiStaticArchitecture(THREE,parent,meshes){
 const buckets=new Map();
 for(const mesh of meshes){
  const material=mesh.material;
  if(mesh.parent!==parent||!mesh.visible||Array.isArray(material)||material.transparent||material.opacity!==1)continue;
  if(!buckets.has(material))buckets.set(material,[]);
  buckets.get(material).push(mesh);
 }
 let originalMeshes=0,batches=0;
 for(const [material,items] of buckets){
  if(items.length<2)continue;
  const parts=items.map(mesh=>{mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);});
  const geometry=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());
  if(!geometry)continue;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const batch=new THREE.Mesh(geometry,material);batch.name='phi-static-architecture-batch';
  parent.add(batch);
  for(const mesh of items){parent.remove(mesh);mesh.geometry.dispose();}
  originalMeshes+=items.length;batches++;
 }
 return {originalMeshes,batches,savedDrawCalls:originalMeshes-batches};
}
