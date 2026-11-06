import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {warmPhiLiftDestination} from '../gallery/visit/phi-lift-destination-warmup.mjs';
import {createPhiArrivalMeshStager} from '../gallery/visit/phi-arrival-mesh-stager.mjs';
import {createPhiPaintingArrivalGate} from '../gallery/visit/phi-painting-arrival-gate.mjs';

test('painting gate opens only after the attached original texture uploads',async()=>{
 const texture={isTexture:true,image:{}},face={parent:{},material:{map:texture}};
 let uploaded=false;
 const gate=createPhiPaintingArrivalGate({date:'test',expected:1,
  upload(t){assert.equal(t,texture);uploaded=true},nextFrame:async()=>{}});
 gate.register('art',face).ready(texture);
 assert.equal(gate.stats().complete,false);
 const result=await gate.wait();assert.ok(uploaded&&result.complete);
});

test('painting upload failure cannot satisfy the door interlock',async()=>{
 const texture={isTexture:true,image:{}},face={parent:{},material:{map:texture}};
 const gate=createPhiPaintingArrivalGate({date:'test',expected:1,
  upload(){throw Error('GPU upload failed')},nextFrame:async()=>{}});
 gate.register('art',face).ready(texture);
 await assert.rejects(gate.wait(),/GPU upload failed/);
 assert.equal(gate.stats().complete,false);
});

test('destination-only preparation preserves identity, hidden state and target lighting',async()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const root=new THREE.Group(),other=new THREE.Group();scene.add(root,other);
 const texture=new THREE.Texture(),outsideTexture=new THREE.Texture();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map:texture}));
 const hidden=new THREE.Mesh(mesh.geometry,mesh.material);hidden.visible=false;
 const light=new THREE.PointLight();root.add(mesh,hidden,light);
 other.add(new THREE.Mesh(mesh.geometry,new THREE.MeshBasicMaterial({map:outsideTexture})));
 const stager=createPhiArrivalMeshStager({nextFrame:async()=>{}});
 stager.start('test',[root]);
 const operations=[];
 await warmPhiLiftDestination({scene,camera,objects:[root,root],nextFrame:async()=>{},renderer:{
  async compileAsync(view,c,target){
   assert.equal(c,camera);assert.equal(target,scene);
   const objects=[];view.traverse(o=>objects.push(o));
   assert.equal(objects.filter(o=>o===mesh).length,1);
   assert.ok(objects.includes(hidden));assert.ok(!objects.includes(other));
   const extraLights=[];view.traverseVisible(o=>{if(o.isLight)extraLights.push(o)});
   assert.equal(extraLights.length,0,'targetScene already supplies every light');
   assert.equal(mesh.visible,false);assert.equal(mesh.parent,root);operations.push('compile');
  },initTexture(t){assert.equal(t,texture);operations.push('upload');}
 }});
 assert.deepEqual(operations,['compile','upload']);
 assert.equal(mesh.visible,false);assert.equal(hidden.visible,false);assert.equal(mesh.parent,root);
 await stager.reveal({batchSize:64});
 assert.equal(mesh.visible,true);assert.equal(hidden.visible,false);
});

test('compilation failure keeps destination hidden and prevents uploads',async()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh();root.add(mesh);mesh.visible=false;
 await assert.rejects(warmPhiLiftDestination({scene:new THREE.Scene(),camera:{},objects:[root],nextFrame:async()=>{},
  renderer:{async compileAsync(){throw Error('compile failed')},initTexture(){assert.fail('upload after failed compile')}}}),/compile failed/);
 assert.equal(mesh.visible,false);assert.equal(mesh.parent,root);
});

test('failed texture upload fails preparation rather than declaring readiness',async()=>{
 const mesh=new THREE.Mesh(undefined,new THREE.MeshBasicMaterial({map:new THREE.Texture()}));
 await assert.rejects(warmPhiLiftDestination({scene:{},camera:{},objects:[mesh],nextFrame:async()=>{},
  renderer:{async compileAsync(){},initTexture(){throw Error('upload failed')}}}),/upload failed/);
});

test('disposed objects and render-target textures are excluded',async()=>{
 const root=new THREE.Group();
 const dead=new THREE.Mesh(undefined,new THREE.MeshBasicMaterial({map:new THREE.Texture()}));
 dead.userData.galleryDisposed=true;
 const rt=new THREE.WebGLRenderTarget(1,1);
 root.add(dead,new THREE.Mesh(undefined,new THREE.MeshBasicMaterial({map:rt.texture})));
 const result=await warmPhiLiftDestination({scene:{},camera:{},objects:[root],nextFrame:async()=>{},
  renderer:{async compileAsync(view){view.traverse(o=>assert.notEqual(o,dead))},initTexture(){assert.fail('unexpected upload')}}});
 assert.equal(result.textures,0);
});

test('larger reveals keep identical final visibility with fewer scheduling waits',async()=>{
 const results=[];
 for(const batchSize of [16,64,1024]){
  const root=new THREE.Group();let waits=0;
  for(let i=0;i<1024;i++)root.add(new THREE.Mesh());
  const stager=createPhiArrivalMeshStager({nextFrame:async()=>{waits++}});
  stager.start('test',[root]);const result=await stager.reveal({batchSize});
  assert.equal(result.shown,1024);assert.ok(root.children.every(x=>x.visible));
  results.push(waits);
 }
 assert.deepEqual(results,[128,32,2]);
});
