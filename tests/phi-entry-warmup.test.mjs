import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {warmGalleryEntry} from '../test/virtual-gallery/phi-entry-warmup.mjs';
import {instrumentShadowPreparation,instrumentWarmupSource} from '../automation/phi-warmup-test-plugin.mjs';
const lightingSource=readFileSync(new URL('../gallery/visit/phi-room-lighting-renderer.mjs',import.meta.url),'utf8');
const {createPhiLightingStudy}=await import('data:text/javascript;base64,'+Buffer.from(instrumentShadowPreparation(lightingSource)).toString('base64'));
globalThis.location={search:''};globalThis.window={};
test('late materials are finalised after upload yields and before compilation',async()=>{
 const calls=[],texture={isTexture:true},video={isTexture:true,isVideoTexture:true};
 let late=false,finalised=false;
 const scene={traverse(fn){fn({material:{map:texture,normalMap:texture,video}});}};
 const result=await warmGalleryEntry({scene,camera:{},prepare(){calls.push('prepare');if(late)finalised=true;},
  renderer:{initTexture(t){assert.equal(t,texture);calls.push('upload');},async compileAsync(){assert.ok(finalised);calls.push('compile');},render(){calls.push('render');}},
  nextFrame:async()=>{late=true;calls.push('yield');}});
 assert.equal(result.textures,1);assert.equal(result.uploadErrors,0);
 assert.deepEqual(calls,['prepare','yield','upload','prepare','compile','render','yield']);
 assert.ok(result.compileMs>=0&&result.totalMs>=result.compileMs);
});
test('explicit shadow preparation catches late meshes without refreshing unchanged maps',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),sun=new THREE.DirectionalLight();
 const renderer={shadowMap:{}};scene.add(sun);
 const light=new THREE.SpotLight();light.name='phi-shadow-room-light';scene.add(light);
 const study=createPhiLightingStudy({THREE,scene,camera,sun,renderer});
 study.prepare();const refreshes=study.stats.refreshes;
 study.prepare();assert.equal(study.stats.refreshes,refreshes);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());scene.add(mesh);
 study.prepare();assert.ok(mesh.receiveShadow&&mesh.castShadow);assert.ok(study.stats.refreshes>refreshes);
 const after=study.stats.refreshes;camera.position.x=1;study.prepare();assert.equal(study.stats.refreshes,after);
 assert.equal(sun.shadow.mapSize.x,2048);assert.equal(light.shadow.mapSize.x,1024);
 assert.equal(renderer.shadowMap.autoUpdate,false);
});
test('both entry paths are instrumented; comparison mode has no mandatory preparation hook',()=>{
 const source=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 const patched=instrumentWarmupSource(source);
 assert.equal(patched.split('shadowStats:phiLightingStudy?.stats').length-1,2);
 assert.match(patched,/phiLightingStudy\?\.prepare\?\.\(\)/);
 assert.doesNotMatch(source,/phi-entry-warmup/);
 location.search='?lighting=original';
 const study=createPhiLightingStudy({});assert.equal(study.stats.enabled,false);study.prepare?.();
 location.search='';
});
