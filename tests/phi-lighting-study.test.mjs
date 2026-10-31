import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPhiLightingStudy,staticPhiShadowCaster} from '../test/virtual-gallery/phi-lighting-study.mjs';
globalThis.location={search:''};globalThis.window={};
function setup(){
 const renderer={shadowMap:{}},scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),sun=new THREE.DirectionalLight();sun.position.set(-18,30,12);scene.add(sun);
 const light=new THREE.SpotLight();light.name='phi-shadow-room-light';light.position.set(0,4,0);scene.add(light);
 const box=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());scene.add(box);
 const study=createPhiLightingStudy({THREE,renderer,scene,camera,sun});return {renderer,scene,camera,sun,light,box,study};
}
test('one cached daylight map and one pooled room map stay unchanged during ordinary camera movement',()=>{
 const {renderer,camera,sun,light,study}=setup();study.update(0);
 assert.equal(renderer.shadowMap.autoUpdate,false);assert.equal(sun.shadow.autoUpdate,false);assert.equal(light.shadow.autoUpdate,false);
 assert.equal(study.stats.shadowMaps,2);const refreshes=study.stats.refreshes;
 camera.position.x=1;study.update(300);study.update(1700);assert.equal(study.stats.refreshes,refreshes);
});
test('late static assets refresh shadows; moving visitors and door leaves do not cast stale shadows',()=>{
 const {scene,study}=setup();study.update(0);const n=study.stats.refreshes;
 scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));study.update(1600);assert.ok(study.stats.refreshes>n);
 const group=new THREE.Group();group.name='Entrance_Left';const moving=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());group.add(moving);assert.equal(staticPhiShadowCaster(moving),false);
 assert.equal(staticPhiShadowCaster(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial())),false);
});
test('floor changes translate the sun and target together, preserving its direction',()=>{
 const {sun,study}=setup();const direction=sun.position.clone().sub(sun.target.position);study.editionChanged(48);
 assert.ok(sun.position.clone().sub(sun.target.position).equals(direction));assert.equal(sun.target.position.y,48);
});
test('manual original comparison leaves shadow rendering disabled',()=>{
 location.search='?lighting=original';const {renderer,study}=setup();study.update(0);assert.equal(renderer.shadowMap.enabled,undefined);assert.equal(study.stats.enabled,false);location.search='';
});
