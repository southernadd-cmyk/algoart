import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';

export function acceleratePhiPickMesh(mesh){
 const geometry=mesh.geometry;
 if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||!geometry?.attributes.position||
  Object.keys(geometry.morphAttributes||{}).length)return false;
 const triangles=(geometry.index?.count||geometry.attributes.position.count)/3;
 if(triangles<512)return false;
 // Indirect mode leaves the original index, face IDs and rendering untouched.
 if(!geometry.boundsTree)geometry.boundsTree=new MeshBVH(geometry,{indirect:true});
 mesh.raycast=acceleratedRaycast;
 return true;
}
export function queuePhiPickBVH(root){
 const enabled=new URLSearchParams(location.search).get('bvh')!=='0';
 const stats=window.__phiMeshBVH={enabled,target:'gramophone',built:0,buildMs:0,pending:0,errors:[]};
 if(!enabled)return;
 const meshes=[];root.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});stats.pending=meshes.length;
 const schedule=callback=>globalThis.requestIdleCallback?requestIdleCallback(callback,{timeout:1500}):setTimeout(callback,0);
 const next=()=>{
  if(!root.parent||root.userData.galleryDisposed){stats.pending=0;return;}
  const mesh=meshes.shift(),start=performance.now();
  try{if(acceleratePhiPickMesh(mesh))stats.built++;}catch(error){stats.errors.push(String(error));}
  stats.buildMs+=performance.now()-start;stats.pending=meshes.length;
  if(meshes.length)schedule(next);
 };
 if(meshes.length)schedule(next);
}
