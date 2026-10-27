import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {batchPhiStaticArchitecture} from '../gallery/visit/phi-static-architecture.mjs';
test('batching retains exact transformed vertices, UVs, material and triangle order',()=>{
 const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial(),meshes=[];
 for(let i=0;i<4;i++){
  const geometry=new THREE.BoxGeometry(2+i,3,4),uv=geometry.getAttribute('uv');
  for(let v=0;v<uv.count;v++)uv.setXY(v,uv.getX(v)*3.7,uv.getY(v)*2.1);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(i*5,i,-i);mesh.rotation.y=i*.3;scene.add(mesh);mesh.updateMatrix();meshes.push(mesh);
 }
 const before=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrix));
 const result=batchPhiStaticArchitecture(THREE,scene,meshes);assert.equal(result.savedDrawCalls,3);assert.equal(scene.children.length,1);
 const batch=scene.children[0];assert.equal(batch.material,material);
 for(const name of ['position','normal','uv']){
  const expected=before.flatMap(g=>Array.from(g.getAttribute(name).array));
  assert.deepEqual(Array.from(batch.geometry.getAttribute(name).array),expected);
 }
 assert.deepEqual(Array.from(batch.geometry.index.array),before.flatMap((g,i)=>Array.from(g.index.array,n=>n+i*24)));
 assert.ok(batch.geometry.boundingSphere);assert.ok(meshes.every(m=>!m.parent));
});
test('transparent surfaces and unregistered moving objects remain individual',()=>{
 const scene=new THREE.Scene(),glass=new THREE.MeshStandardMaterial({transparent:true,opacity:.5}),solid=new THREE.MeshStandardMaterial();
 const door=new THREE.Mesh(new THREE.BoxGeometry(),solid);scene.add(door);
 const panes=[0,1].map(()=>{const m=new THREE.Mesh(new THREE.BoxGeometry(),glass);scene.add(m);return m;});
 const result=batchPhiStaticArchitecture(THREE,scene,panes);assert.equal(result.batches,0);assert.equal(scene.children.length,3);assert.equal(door.parent,scene);
});
