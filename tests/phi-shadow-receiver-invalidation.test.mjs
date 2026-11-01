import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPhiLightingStudy} from '../test/virtual-gallery/phi-room-lighting-renderer.mjs';

// Verify that shadow receiving/casting and lighting settings are unchanged.
// The optimization may not change maps, shaders, colours, source artwork,
// mesh materials or any light fixture placement.
globalThis.location={search:''};
globalThis.window={};
function simulate(skipReceiverMaterialInvalidation){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 camera.position.set(0,1.6,4);scene.add(camera);
 const sun=new THREE.DirectionalLight('#fff5e5',2.35);sun.position.set(-18,30,12);scene.add(sun);
 const first=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial({color:0x879a78}));
 first.position.set(0,1,0);first.name='phi-static-architecture';scene.add(first);
 const second=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),first.material);
 second.position.set(2,1,0);second.name='phi-static-detail';scene.add(second);
 const transparent=new THREE.Mesh(new THREE.PlaneGeometry(2,2),
  new THREE.MeshBasicMaterial({transparent:true}));
 scene.add(transparent);
 const light=new THREE.SpotLight(0xfff3df,14,12,.7,.9,1.5);
 light.name='phi-shadow-room-light';light.position.set(0,3,0);scene.add(light,light.target);
 const renderer={shadowMap:{enabled:false,needsUpdate:false,autoUpdate:true,type:null}};
 const study=createPhiLightingStudy({THREE,renderer,scene,camera,sun,skipReceiverMaterialInvalidation});
 study.update(100);
 const result={
  receivers:[first.receiveShadow,second.receiveShadow,transparent.receiveShadow],
  casters:[first.castShadow,second.castShadow,transparent.castShadow],
  materialVersion:first.material.version,
  materialId:first.material.id,
  materialColor:first.material.color.getHex(),
  transparentVersion:transparent.material.version,
  lights:[sun.castShadow,light.castShadow,sun.shadow.mapSize.x,sun.shadow.mapSize.y,
   light.shadow.mapSize.x,light.shadow.mapSize.y,sun.shadow.bias,sun.shadow.normalBias],
  refreshes:study.stats.refreshes,
  receiverUpdates:study.stats.receiverUpdates,
  invalidations:study.stats.receiverMaterialInvalidations,
  shadowEnabled:renderer.shadowMap.enabled,
  shadowType:renderer.shadowMap.type,
  shadowAutoUpdate:renderer.shadowMap.autoUpdate
 };
 scene.clear();
 return result;
}
test('fast receiver path preserves every visual shadow state and omits only explicit material invalidation',()=>{
 const normal=simulate(false),fast=simulate(true);
 assert.deepEqual(normal.receivers,fast.receivers);
 assert.deepEqual(normal.casters,fast.casters);
 assert.deepEqual(normal.receivers,[true,true,false]);
 assert.deepEqual(normal.casters,[true,true,false]);
 assert.deepEqual(normal.lights,fast.lights);
 assert.equal(normal.materialColor,fast.materialColor);
 assert.equal(normal.shadowEnabled,fast.shadowEnabled);
 assert.equal(normal.shadowAutoUpdate,fast.shadowAutoUpdate);
 assert.equal(normal.shadowType,fast.shadowType);
 assert.equal(normal.refreshes,fast.refreshes);
 assert.equal(normal.receiverUpdates,fast.receiverUpdates);
 assert.equal(normal.receiverUpdates,2);
 assert.equal(normal.invalidations,2);
 assert.equal(fast.invalidations,0);
 assert.ok(normal.materialVersion>fast.materialVersion);
 assert.equal(fast.materialVersion,0);
 assert.equal(normal.transparentVersion,fast.transparentVersion);
});
