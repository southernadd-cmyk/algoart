import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {acceleratePhiPickMesh} from '../test/virtual-gallery/phi-mesh-bvh.mjs';
import {patchBVHPicking} from '../automation/phi-bvh-test-plugin.mjs';

// Read the real model geometry directly: no browser, textures or WebGL needed.
function gramophone(){
 const file=readFileSync('gallery/visit/models/reception-gramophone.glb');
 const jsonLength=file.readUInt32LE(12),doc=JSON.parse(file.toString('utf8',20,20+jsonLength));
 const bin=file.subarray(28+jsonLength),meshes=[];
 const types={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attribute(id){
  const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],T=types[a.componentType];
  const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
  assert.ok(T&&size&&!a.sparse,'fixture uses standard accessors');
  const offset=(v.byteOffset||0)+(a.byteOffset||0),width=size*T.BYTES_PER_ELEMENT;
  const copy=new Uint8Array(a.count*width);
  for(let i=0;i<a.count;i++)copy.set(bin.subarray(offset+i*(v.byteStride||width),offset+i*(v.byteStride||width)+width),i*width);
  return new THREE.BufferAttribute(new T(copy.buffer),size,a.normalized||false);
 }
 for(const m of doc.meshes)for(const p of m.primitives){
  const g=new THREE.BufferGeometry();g.setAttribute('position',attribute(p.attributes.POSITION));
  if(p.attributes.TEXCOORD_0!==undefined)g.setAttribute('uv',attribute(p.attributes.TEXCOORD_0));
  if(p.indices!==undefined)g.setIndex(attribute(p.indices));
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();meshes.push(mesh);
 }
 return meshes;
}
test('real gramophone: BVH preserves hit distances, face indices, UVs and geometry buffers',()=>{
 const meshes=gramophone(),rays=[];
 for(const mesh of meshes){
  mesh.geometry.computeBoundingSphere();const {center,radius}=mesh.geometry.boundingSphere;
  for(let i=0;i<160;i++){
   const direction=new THREE.Vector3(Math.cos(i*2.399),Math.sin(i*.741),Math.cos(i*.489)).normalize();
   const origin=center.clone().addScaledVector(direction,radius*3);
   rays.push({mesh,ray:new THREE.Raycaster(origin,direction.negate())});
  }
 }
 const query=()=>rays.map(({mesh,ray})=>ray.intersectObject(mesh,false));
 query();let start=performance.now();const before=query();const baseline=performance.now()-start;
 const indices=meshes.map(m=>m.geometry.index?.array.slice());
 start=performance.now();assert.ok(meshes.map(acceleratePhiPickMesh).filter(Boolean).length>0);
 const build=performance.now()-start;
 query();start=performance.now();const after=query();const accelerated=performance.now()-start;
 for(let i=0;i<before.length;i++){
  assert.equal(after[i].length,before[i].length);
  for(let k=0;k<before[i].length;k++){
   assert.ok(Math.abs(before[i][k].distance-after[i][k].distance)<1e-6);
   assert.equal(before[i][k].faceIndex,after[i][k].faceIndex);
   if(before[i][k].uv)assert.ok(before[i][k].uv.distanceTo(after[i][k].uv)<1e-6);
  }
 }
 for(let i=0;i<meshes.length;i++)assert.deepEqual(meshes[i].geometry.index?.array,indices[i]);
 console.log(JSON.stringify({rays:rays.length,baselineMs:+baseline.toFixed(2),bvhMs:+accelerated.toFixed(2),buildMs:+build.toFixed(2)}));
});
test('simple and animated meshes remain on the original raycaster',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),original=mesh.raycast;
 assert.equal(acceleratePhiPickMesh(mesh),false);assert.equal(mesh.raycast,original);
 mesh.isSkinnedMesh=true;assert.equal(acceleratePhiPickMesh(mesh),false);
});
test('integration is limited to test gramophone picking',()=>{
 const source=readFileSync('gallery/visit/phi-reception-gramophone.mjs','utf8');
 assert.doesNotMatch(source,/queuePhiPickBVH|three-mesh-bvh/);
 assert.match(patchBVHPicking(source),/queuePhiPickBVH\(model\)/);
 assert.throws(()=>patchBVHPicking('changed'),/anchor changed/);
});
