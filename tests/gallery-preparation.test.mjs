import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGalleryPreparationQueue,configureGalleryPreparation,prepareGalleryModel,neutralGalleryMaps} from '../gallery/visit/gallery-preparation.mjs';

test('preparation yields between tasks, honours priority and recovers from failure',async()=>{
 const frames=[],events=[];
 const queue=createGalleryPreparationQueue({yieldFrame:()=>new Promise(resolve=>frames.push(resolve))});
 const first=queue.enqueue(()=>events.push('low'));
 const urgent=queue.enqueue(()=>events.push('high'),{priority:2});
 assert.deepEqual(events,[]);frames.shift()();await urgent;
 assert.deepEqual(events,['high']);frames.shift()();await first;
 assert.deepEqual(events,['high','low']);
 const failed=queue.enqueue(()=>{throw Error('test failure');});const rejected=assert.rejects(failed,/test failure/);
 frames.shift()();await rejected;
 const next=queue.enqueue(()=>42);frames.shift()();assert.equal(await next,42);
 assert.equal(queue.stats.completed,3);assert.equal(queue.stats.failed,1);
});

test('model attachment is staggered without forced shader compilation or texture upload',async()=>{
 const tasks=createGalleryPreparationQueue({yieldFrame:async()=>{}});
 const models=createGalleryPreparationQueue({yieldFrame:async()=>{}});
 const texture=new THREE.Texture({width:2048,height:2048});
 const material=new THREE.MeshStandardMaterial({map:texture});
 const model=new THREE.Group(),geometry=new THREE.BoxGeometry();
 model.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),calls=[];
 configureGalleryPreparation({scene,camera,textureTasks:tasks,models,renderer:{
  async compileAsync(group,view,target){assert.equal(group.parent,null);assert.equal(view,camera);assert.equal(target,scene);calls.push('compile');},
  initTexture(value){assert.equal(value,texture);calls.push('upload');}
 }});
 try{
  assert.equal(await prepareGalleryModel(model),model);
  assert.deepEqual(calls,[]);assert.equal(model.children.length,2);
  assert.equal(texture.image.width,2048);assert.equal(model.children[0].geometry,geometry);assert.equal(model.parent,null);
 }finally{configureGalleryPreparation(null);}
});

test('neutral maps are shared, white/flat and correctly tagged',()=>{
 const a=neutralGalleryMaps(THREE);assert.equal(a,neutralGalleryMaps(THREE));
 assert.deepEqual([...a.white.image.data],[255,255,255,255]);
 assert.deepEqual([...a.normal.image.data],[128,128,255,255]);
 assert.equal(a.white.colorSpace,THREE.SRGBColorSpace);assert.equal(a.normal.colorSpace,THREE.NoColorSpace);
 assert.equal(a.normal.userData.galleryPersistent,true);
});
