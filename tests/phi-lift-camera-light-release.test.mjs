import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPhiStablePointLightPool,countVisibleRealPhiPointLights} from '../gallery/visit/phi-stable-point-lights.mjs';

function renderable(scene,camera){
 let n=0;
 scene.traverseVisible(o=>{if(o.isPointLight&&o.layers.test(camera.layers))n++});
 return n;
}
function create(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 camera.layers.set(0);
 const pool=createPhiStablePointLightPool({THREE,scene,camera,enabled:true,target:8,cameraAware:true});
 return {scene,camera,pool};
}
test('eight camera-renderable point lights survive a hidden destination parent',()=>{
 const {scene,camera,pool}=create();
 const dark=new THREE.Group();dark.visible=false;scene.add(dark);
 dark.add(new THREE.PointLight('white',5));
 for(let i=0;i<7;i++)scene.add(new THREE.PointLight('white',i+1));
 let result=pool.sync('before-render');
 assert.equal(result.real,7);
 assert.equal(result.spares,1);
 assert.equal(renderable(scene,camera),8);
 // A destination arrival moves an existing real light into a hidden group.
 dark.add(scene.children.find(o=>o.isPointLight&&!pool.spares.includes(o)));
 result=pool.sync('before-render');
 assert.equal(result.real,6);
 assert.equal(result.spares,2);
 assert.equal(renderable(scene,camera),8);
 assert.equal(pool.stats.stable,true);
});
test('camera layers exclude real lights while zero-intensity spares fill slots',()=>{
 const {scene,camera,pool}=create();
 for(let i=0;i<8;i++)scene.add(new THREE.PointLight('white',3));
 const excluded=scene.children.find(o=>o.isPointLight);
 excluded.layers.set(2);
 assert.equal(countVisibleRealPhiPointLights(scene,[],camera),7);
 pool.sync('before-render');
 assert.equal(pool.stats.spares,1);
 assert.equal(renderable(scene,camera),8);
 const spare=pool.spares.find(o=>o.parent===scene);
 assert.equal(spare.intensity,0);
 assert.equal(spare.castShadow,false);
 assert.equal(spare.layers.mask,camera.layers.mask);
 camera.layers.set(2);
 pool.sync('before-render');
 assert.equal(renderable(scene,camera),8);
});
test('late lights are rebalanced before the first render without changing real illumination',()=>{
 const {scene,camera,pool}=create();
 for(let i=0;i<5;i++)scene.add(new THREE.PointLight('white',i+2));
 pool.sync('boundary');
 assert.equal(renderable(scene,camera),8);
 const light=new THREE.PointLight('white',17);
 scene.add(light);
 pool.sync('before-render');
 assert.equal(renderable(scene,camera),8);
 assert.equal(pool.stats.spares,2);
 assert.equal(light.intensity,17);
 scene.remove(light);
 pool.sync('before-render');
 assert.equal(renderable(scene,camera),8);
 assert.equal(pool.stats.spares,3);
});
test('pointpool=0-style disabled state does not add lights',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const pool=createPhiStablePointLightPool({THREE,scene,camera,enabled:false,target:8,cameraAware:true});
 pool.sync('before-render');
 assert.equal(scene.children.length,0);
});
test('scene overcapacity is reported without mutating real lights',()=>{
 const {scene,camera,pool}=create();
 for(let i=0;i<9;i++)scene.add(new THREE.PointLight('white',i+3));
 const status=pool.sync('before-render');
 assert.equal(status.real,9);
 assert.equal(status.overCapacity,1);
 assert.equal(status.stable,false);
 assert.equal(renderable(scene,camera),9);
});
