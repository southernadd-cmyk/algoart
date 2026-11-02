import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createPhiStablePointLightPool,countVisibleRealPhiPointLights,PHI_STABLE_POINT_COUNT} from '../gallery/visit/phi-stable-point-lights.mjs';
const live=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
const testTower=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
const liveHelper=readFileSync(new URL('../gallery/visit/phi-stable-point-lights.mjs',import.meta.url),'utf8');
const testHelper=readFileSync(new URL('../test/virtual-gallery/phi-stable-point-lights.mjs',import.meta.url),'utf8');

test('production and approved TEST point-light stabilisation implementations match',()=>{
 assert.equal(liveHelper.slice(liveHelper.indexOf('export const PHI_STABLE_POINT_COUNT')),
  testHelper.slice(testHelper.indexOf('export const PHI_STABLE_POINT_COUNT')));
 assert.equal(PHI_STABLE_POINT_COUNT,7);
});
test('production enables point stabilisation by default with emergency override',()=>{
 assert.match(live,/const phiStablePointLights=createPhiStablePointLightPool\(\{THREE,scene,\s*enabled:new URLSearchParams\(location\.search\)\.get\('pointpool'\)!=='0'\}\)/);
 assert.match(live,/window\.__phiStablePointLights=phiStablePointLights\.stats/);
});
test('production balances at all three approved transition sites',()=>{
 assert.match(live,/phiTowerShellCache\?\.controller\.activate\(currentFloor\);\s*\/\/ Reconcile light slots immediately after the retained floor disappears\.\s*phiStablePointLights\.sync\(\)/);
 assert.match(live,/editionObjects=scene\.children\.filter\(object=>!previous\.has\(object\)&&object!==phiTowerShellCache\?\.shell\);\s*\/\/ Dark placeholder lights are persistent and must not become edition-owned\.\s*phiStablePointLights\.sync\(\)/);
 assert.match(live,/if\(liftArrivalOpening\)phiStablePointLights\.sync\('pre-render-doors-opening'\);/);
 assert.ok(live.indexOf("phiStablePointLights.sync('pre-render-doors-opening')")<live.indexOf('phiPostFX.render(dt',live.indexOf("phiStablePointLights.sync('pre-render-doors-opening')")));
 assert.match(testTower,/if\(liftArrivalOpening\)phiStablePointLights\.sync\('pre-render-doors-opening'\);/);
});
test('the three-room plus three-art spotlight pool remains the live default',()=>{
 assert.match(live,/const phiBoundedLightPoolEnabled=new URLSearchParams\(location\.search\)\.get\('lightpool'\)!=='0'/);
 assert.match(live,/const phiRoomSpotPool=phiBoundedLightPoolEnabled\?Array\.from\(\{length:PHI_ROOM_POOL_SIZE\}/);
});
test('a late light is offset with a zero intensity placeholder before rendering',()=>{
 const scene=new THREE.Scene();
 const real=Array.from({length:6},(_,i)=>{
  const l=new THREE.PointLight(0xffeedd,i+1,7,2);scene.add(l);return l;
 });
 const study=createPhiStablePointLightPool({THREE,scene,enabled:true});
 assert.equal(study.sync('floor').total,7);
 const late=new THREE.PointLight(0xffffff,8,10,2);scene.add(late);
 const result=study.sync('pre-render-doors-opening');
 assert.equal(result.total,7);
 assert.equal(result.real,7);
 assert.equal(result.spares,0);
 assert.equal(countVisibleRealPhiPointLights(scene,study.spares),7);
 assert.equal(late.intensity,8);
 assert.ok(study.spares.every(x=>x.intensity===0&&!x.castShadow));
 for(const l of real)assert.ok(l.intensity>0);
});
