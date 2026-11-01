import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPhiRoomBatchStudy,packPhiRoomPaintingGroups} from '../test/virtual-gallery/phi-room-batch-study.mjs';

test('room geometry merge preserves floor and ceiling vertex positions',()=>{
 const scene=new THREE.Scene(),study=createPhiRoomBatchStudy(THREE,scene,2,{enabled:true});
 const mat=new THREE.MeshStandardMaterial();
 const original=[];
 for(let i=0;i<6;i++){
  const obj=new THREE.Mesh(new THREE.BoxGeometry(2+i*.2,.18,1.1),mat);
  obj.position.set(i*3,3.2,-i*.4);scene.add(obj);original.push(obj);
  assert.equal(study.take(i<3?0:1,obj,{architecture:true}),true);
 }
 const before=original.map(obj=>{
  obj.updateMatrix();
  return Array.from(obj.geometry.clone().applyMatrix4(obj.matrix).getAttribute('position').array);
 });
 const stats=study.finish();
 assert.equal(stats.active,true);assert.equal(stats.rooms,2);
 assert.equal(stats.architecturalMerges,2);
 assert.equal(stats.architecturalDrawCallsSaved,4);
 for(const [room,range] of [[0,[0,1,2]],[1,[3,4,5]]]){
  const group=study.group(room);
  assert.equal(group.children.length,1);
  const actual=Array.from(group.children[0].geometry.getAttribute('position').array);
  const expected=range.flatMap(i=>before[i]);
  assert.equal(actual.length,expected.length);
  for(let i=0;i<actual.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<1e-5);
 }
});

test('room root rotates with floor without modifying painting or visibility',()=>{
 const scene=new THREE.Scene(),study=createPhiRoomBatchStudy(THREE,scene,2,{enabled:true});
 const art=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());
 art.position.set(6,2,4);scene.add(art);study.take(0,art);study.finish();
 const group=study.group(0);assert.equal(art.parent,group);
 group.position.set(-3,0,8);group.rotation.y=.618;group.updateWorldMatrix(true,true);
 const actual=art.getWorldPosition(new THREE.Vector3());
 const expected=new THREE.Vector3(6,2,4).applyAxisAngle(new THREE.Vector3(0,1,0),.618).add(new THREE.Vector3(-3,0,8));
 assert.ok(actual.distanceTo(expected)<1e-6);
 group.visible=false;assert.equal(art.visible,true);
});

test('deferred sculpture attaches to rotated root without changing world placement',()=>{
 const scene=new THREE.Scene(),study=createPhiRoomBatchStudy(THREE,scene,1,{enabled:true});
 const art=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());
 scene.add(art);study.take(0,art);study.finish();
 const root=study.group(0);root.rotation.y=1.2;root.position.set(8,2,-3);root.updateWorldMatrix(true,true);
 const sculpture=new THREE.Group();sculpture.position.set(3,18,-7);scene.add(sculpture);
 const before=sculpture.getWorldPosition(new THREE.Vector3());
 assert.equal(study.attachLate(0,sculpture),true);assert.equal(sculpture.parent,root);
 assert.ok(sculpture.getWorldPosition(new THREE.Vector3()).distanceTo(before)<1e-6);
});

test('disabled mode preserves exact scene tree',()=>{
 const scene=new THREE.Scene(),study=createPhiRoomBatchStudy(THREE,scene,2,{enabled:false});
 const art=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
 scene.add(art);assert.equal(study.take(1,art),false);
 assert.equal(study.finish().active,false);assert.deepEqual(scene.children,[art]);
});

test('room-scoped packing preserves all original frame meshes when batching is off',()=>{
 const scene=new THREE.Scene(),study=createPhiRoomBatchStudy(THREE,scene,2,{enabled:true});
 const mat=new THREE.MeshStandardMaterial(),frames=[];
 for(let room=0;room<2;room++)for(let i=0;i<3;i++){
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1+i,2,.08),mat);
  frame.position.set(room*10+i,1,0);scene.add(frame);frames.push({room,mesh:frame});
 }
 const result=packPhiRoomPaintingGroups(THREE,scene,study,{
  frames,captions:[],frameBatchEnabled:false,captionBatchEnabled:false
 });
 assert.equal(result.frame.original,6);assert.equal(result.frame.batched,6);
 assert.equal(result.frame.savedDrawCalls,0);
 study.finish();
 assert.equal(study.group(0).children.length,3);
 assert.equal(study.group(1).children.length,3);
});
