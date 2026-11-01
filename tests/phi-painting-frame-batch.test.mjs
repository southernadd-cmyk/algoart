import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchPhiPaintingFrames} from '../test/virtual-gallery/phi-painting-frame-batch.mjs';
import {
 createPhiFrameStudyMaterial,PHI_FRAME_VERTEX,PHI_FRAME_INSTANCED_VERTEX,
 PHI_FRAME_FRAGMENT
} from '../test/virtual-gallery/phi-frame-material.mjs';

const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<=eps,`expected ${a} ~= ${b}`);

test('frame instancing preserves geometry, normals, UV and original shader coordinates',()=>{
 const scene=new THREE.Scene(),shared=new THREE.MeshStandardMaterial({color:'#344452'}),original=[];
 const shapes=[[.08,1.76,2.9],[2.36,1.26,.08],[.08,2.8,1.2],[1.64,2.3,.08]];
 for(let i=0;i<shapes.length;i++){
  const [w,h,d]=shapes[i];
  const frame=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),shared);
  frame.position.set(i*2.37,6.2+i*.75,1.15-i*.61);
  scene.add(frame);original.push(frame);
 }
 const expected=original.map(frame=>{
  frame.updateMatrix();
  return {geometry:frame.geometry.clone(),matrix:frame.matrix.clone()};
 });
 const stats=batchPhiPaintingFrames(THREE,scene,original,{
  createMaterial:()=>new THREE.MeshStandardMaterial({color:'#344452'})
 });
 assert.deepEqual({active:stats.active,original:stats.original,batched:stats.batched,saved:stats.savedDrawCalls},
  {active:true,original:4,batched:1,saved:3});
 assert.equal(scene.children.length,1);
 const batch=scene.children[0];
 assert.equal(batch.isInstancedMesh,true);
 assert.equal(batch.geometry.getAttribute('phiFrameDimensions').count,4);
 assert.equal(batch.geometry.index.count,expected[0].geometry.index.count);
 for(let i=0;i<expected.length;i++){
  const shape=shapes[i],dims=batch.geometry.getAttribute('phiFrameDimensions');
  for(let c=0;c<3;c++)near(dims.getComponent(i,c),shape[c]);
  const instanceMatrix=new THREE.Matrix4();batch.getMatrixAt(i,instanceMatrix);
  const originalPos=expected[i].geometry.getAttribute('position');
  const batchPos=batch.geometry.getAttribute('position');
  const originalNormal=expected[i].geometry.getAttribute('normal');
  const batchNormal=batch.geometry.getAttribute('normal');
  const originalUV=expected[i].geometry.getAttribute('uv');
  const batchUV=batch.geometry.getAttribute('uv');
  for(let vertex=0;vertex<originalPos.count;vertex++){
   const a=new THREE.Vector3().fromBufferAttribute(originalPos,vertex).applyMatrix4(expected[i].matrix);
   const b=new THREE.Vector3().fromBufferAttribute(batchPos,vertex).applyMatrix4(instanceMatrix);
   near(a.x,b.x);near(a.y,b.y);near(a.z,b.z);
   for(let axis=0;axis<3;axis++){
    near(originalNormal.getComponent(vertex,axis),batchNormal.getComponent(vertex,axis));
   }
   near(originalUV.getX(vertex),batchUV.getX(vertex));
   near(originalUV.getY(vertex),batchUV.getY(vertex));
   // Shader samples the true previous BoxGeometry vertex coordinates.
   near(originalPos.getX(vertex),batchPos.getX(vertex)*dims.getX(i));
   near(originalPos.getY(vertex),batchPos.getY(vertex)*dims.getY(i));
   near(originalPos.getZ(vertex),batchPos.getZ(vertex)*dims.getZ(i));
  }
  expected[i].geometry.dispose();
 }
});
test('original and instanced CSM use identical pigment fragment expression and properties',()=>{
 assert.ok(PHI_FRAME_VERTEX.includes('vPhiFramePosition=position;'));
 assert.ok(PHI_FRAME_INSTANCED_VERTEX.includes('vPhiFramePosition=position*phiFrameDimensions;'));
 assert.ok(PHI_FRAME_FRAGMENT.includes('csm_Roughness=clamp'));
 const orig=createPhiFrameStudyMaterial(THREE,{enabled:true});
 const inst=createPhiFrameStudyMaterial(THREE,{enabled:true,instanced:true});
 assert.equal(orig.color.getHex(),inst.color.getHex());
 assert.equal(orig.roughness,inst.roughness);
 assert.equal(orig.metalness,inst.metalness);
 assert.equal(orig.userData.galleryPersistent,true);
 assert.equal(inst.userData.galleryPersistent,false);
 orig.dispose();inst.dispose();
});
test('opt-in batch failure retains originals without disposing geometry',()=>{
 const scene=new THREE.Scene(),mat=new THREE.MeshStandardMaterial(),frames=[];
 for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(1+i,1,1),mat);scene.add(m);frames.push(m);}
 const before=frames.map(m=>m.geometry);
 const stats=batchPhiPaintingFrames(THREE,scene,frames,{createMaterial:()=>{throw Error('material unavailable');}});
 assert.equal(stats.active,false);
 assert.equal(stats.savedDrawCalls,0);
 assert.deepEqual(scene.children,frames);
 for(let i=0;i<frames.length;i++)assert.equal(frames[i].geometry,before[i]);
});
test('batch rejects inconsistent materials and non-box geometry',()=>{
 const scene=new THREE.Scene();
 const a=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
 const b=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial());
 scene.add(a,b);
 const stats=batchPhiPaintingFrames(THREE,scene,[a,b],{createMaterial:()=>new THREE.MeshStandardMaterial()});
 assert.equal(stats.active,false);
 assert.equal(scene.children.length,2);
});
