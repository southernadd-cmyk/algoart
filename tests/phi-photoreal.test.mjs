import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createPhotorealMaterialBank,tiledBoxUvs,photorealEnabled} from '../test/virtual-gallery/photoreal-materials.mjs';
import {createPhotorealEnvironment,protectedExhibit,photorealBox,PHOTO_FX} from '../test/virtual-gallery/photoreal-environment.mjs';
import {patchPhotorealExterior,patchPhotorealVisitors} from '../automation/phi-photoreal-test-plugin.mjs';

globalThis.location={search:''};globalThis.window={};
globalThis.document={getElementById:()=>null};
const pending=[];
class TextureLoader{load(url,done,progress,fail){const texture=new THREE.Texture();pending.push({url,done,fail,texture});return texture;}}
let captures=0;
class PMREMGenerator{
 fromScene(){captures++;return {texture:new THREE.Texture()};}
 fromEquirectangular(){captures++;return {texture:new THREE.Texture()};}
 dispose(){}
}
const T={...THREE,TextureLoader,PMREMGenerator};

test('matched PBR sets use correct colour spaces and retain all three timber variants',()=>{
 const bank=createPhotorealMaterialBank(T,{lowPower:false});
 assert.equal(bank.floor.map.colorSpace,THREE.SRGBColorSpace);
 assert.equal(bank.floor.normalMap.colorSpace,THREE.NoColorSpace);
 assert.equal(bank.floor.roughnessMap.colorSpace,THREE.NoColorSpace);
 assert.equal(bank.timberVariants.length,3);
 assert.ok(bank.timberVariants.every(m=>m.normalMap&&m.roughnessMap));
 assert.equal(bank.timber.map,bank.timberVariants[1].map,'Reuse matching scans rather than duplicate GPU textures');
 assert.equal(bank.trims.roughness,.66);assert.equal(bank.trims.metalness,.15);
 assert.equal(bank.plinth.roughness,.9);
 assert.ok(bank.trims.userData.photorealProtected&&bank.plinth.userData.photorealProtected);
 for(let i=0;i<12;i++)assert.equal(bank.floorForRoom('2026-10-30',i,12),bank.floorForRoom('2026-10-30',i,12));
});
test('reflection finish excludes every sculpture descendant and source artwork',()=>{
 const scene=new THREE.Scene(),sculpture=new THREE.Group();sculpture.name='Traced material sculpture: 123';
 const sculptureMaterial=new THREE.MeshStandardMaterial({color:'#314856'});
 const sculptureMesh=new THREE.Mesh(new THREE.BoxGeometry(),sculptureMaterial);sculpture.add(sculptureMesh);scene.add(sculpture);
 const art=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());art.userData.phiArtOriginal=true;scene.add(art);
 const monument=new THREE.Group();monument.userData.permanentPlazaSculpture='growth';monument.add(new THREE.Mesh(new THREE.BoxGeometry(),sculptureMaterial));scene.add(monument);
 const env=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());scene.add(env);
 const finishes=createPhotorealMaterialBank(T),postFX={settings:{architectural:{}},setPreset(){}};
 const before=scene.environment;captures=0;
 const effect=createPhotorealEnvironment({THREE:T,renderer:{},scene,finishes,postFX});effect.update(0);
 assert.equal(protectedExhibit(sculptureMesh),true);assert.equal(protectedExhibit(env),false);
 assert.equal(sculptureMaterial.envMap,null);assert.equal(art.material.envMap,null);
 assert.ok(env.material.envMap);assert.equal(scene.environment,before);
 assert.equal(finishes.trims.envMap,null);assert.equal(finishes.plinth.envMap,null);
 const materials=effect.stats.materials;effect.update(1600);assert.equal(effect.stats.materials,materials);
 assert.equal(captures,1,'An ordinary frame cannot recapture reflections');
 assert.deepEqual(postFX.settings.architectural,PHOTO_FX);
 // Completing the photographic probe adds exactly one prefilter, and never
 // rewrites sculpture materials or turns it into a per-frame cube capture.
 const load=pending.findLast(p=>p.url.endsWith('day-environment-hdri-101-2k.jpg'));
 load.done(load.texture);effect.update(3200);effect.update(5000);
 assert.equal(captures,2);assert.equal(scene.background,load.texture);assert.equal(sculptureMaterial.envMap,null);
});
test('architectural bevels retain collision dimensions and metre-scaled UVs on all vertices',()=>{
 const geometry=photorealBox(8,4,.24);tiledBoxUvs(geometry,8,4,.24,2);
 geometry.computeBoundingBox();const size=geometry.boundingBox.getSize(new THREE.Vector3());
 assert.ok(Math.abs(size.x-8)<1e-5&&Math.abs(size.y-4)<1e-5&&Math.abs(size.z-.24)<1e-5);
 const uv=geometry.getAttribute('uv');
 assert.ok(uv.count>24);assert.ok([...uv.array].every(Number.isFinite));
 assert.ok(Math.max(...Array.from({length:uv.count},(_,i)=>uv.getX(i)))>1.9);
 assert.ok(Math.min(...Array.from({length:uv.count},(_,i)=>uv.getX(i)))< -1.9);
});
test('photographic environment and unoccupied comparison remain confined to staging',()=>{
 location.search='?environment=original';assert.equal(photorealEnabled(),false);
 location.search='';assert.equal(photorealEnabled(),true);
 const exterior=patchPhotorealExterior(readFileSync(new URL('../gallery/visit/environment-render.mjs',import.meta.url),'utf8'));
 assert.match(exterior,/photorealEnabled\(\)\?null:addProceduralBackdrop/);
 assert.match(exterior,/colors\.setXYZ\(i,1,1,1\)/,'Keep the original horizon vertex alpha');
 const visitors=patchPhotorealVisitors(readFileSync(new URL('../gallery/visit/visitors.mjs',import.meta.url),'utf8'));
 assert.match(visitors,/plan=\{\.\.\.plan,people:\[\]\}/);
 assert.match(visitors,/if\(photorealEnabled\(\)\)return null/);
 const live=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.doesNotMatch(live,/photoreal-environment|photoreal-materials/);
});
test('all locally delivered scan maps are actual WebP images',()=>{
 for(const asset of ['concrete_floor','wood_floor'])for(const slot of ['color','normal','roughness']){
  const image=readFileSync(new URL('../test/virtual-gallery/photoreal-assets/'+asset+'-'+slot+'.webp',import.meta.url));
  assert.equal(image.toString('ascii',0,4),'RIFF');assert.equal(image.toString('ascii',8,12),'WEBP');assert.ok(image.length>10000);
 }
});
