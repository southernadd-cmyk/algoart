import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {instrumentPhiSource} from '../automation/build-phi-post-test.mjs';
import {summariseFrames} from '../test/virtual-gallery/phi-postprocessing.mjs';
import * as THREE from 'three';
import {createPhiShadows,isPhiShadowSurface} from '../test/virtual-gallery/phi-shadows.mjs';

test('long stalls are retained in frame statistics',()=>{
 const result=summariseFrames([16,17,18,60,220,1000]);
 assert.equal(result.count,6);assert.equal(result.over50,3);assert.equal(result.over180,2);
 assert.equal(result.p95,1000);
});
test('staging transform covers both presentation branches and warm-up',()=>{
 const source=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 const transformed=instrumentPhiSource(source);
 if(source.includes('createPhiPostFX(THREE,renderer,scene,camera')){
  assert.equal(transformed,source,'legacy study must not inject a second composer');
  assert.equal((source.match(/phiPostFX.render\(dt/g)||[]).length,2);
  assert.ok(source.includes('phiPostFX.resize(innerWidth,innerHeight)'));
 }else{
  assert.equal((transformed.match(/phiPresentation.render\(\)/g)||[]).length,2);
  assert.ok(transformed.includes('await phiPresentation?.warm()'));
  assert.ok(transformed.includes('phiPresentation?.resize()'));
 }
 assert.ok(!source.includes('phiPresentation'));
});
test('live entry keeps its existing bundle and contains no experiment',()=>{
 const live=readFileSync(new URL('../gallery/visit/index.html',import.meta.url),'utf8');
 assert.ok(live.includes("import('./gallery-phi-bundle.js?"));
 assert.ok(!live.includes('phi-post-test-bundle'));
});

test('test bundle preserves the gallery asset base for import.meta.url loaders',()=>{
 const builder=readFileSync(new URL('../automation/build-phi-post-test.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../test/virtual-gallery/full-engine.html',import.meta.url),'utf8');
 const bundlePath=builder.match(/outfile:'([^']+)'/)[1];
 assert.equal(bundlePath,'gallery/visit/gallery-phi-post-test-bundle.js');
 assert.ok(html.includes('<base href="../../gallery/visit/">'));
 assert.ok(html.includes("import('./gallery-phi-test-room-signs-bundle.js?"));
 const roomSignBundle=new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url);
 const builderText=readFileSync(roomSignBundle,'utf8');
 assert.match(builderText,/outfile:\x27gallery\/visit\/gallery-phi-test-room-signs-bundle\.js\x27/);
 assert.ok(!html.includes('phi-post-test-bundle'));
 const base=new URL(bundlePath,'https://example.test/algoart/');
 assert.equal(new URL('./textures/bajwa-floor-tiles/color.webp',base).pathname,
  '/algoart/gallery/visit/textures/bajwa-floor-tiles/color.webp');
 assert.equal(new URL('./models/plants-scene-gallery-optimized.glb',base).pathname,
  '/algoart/gallery/visit/models/plants-scene-gallery-optimized.glb');
});

test('shadows exclude unlit art, glazing and the reflecting pool',()=>{
 const mesh=m=>new THREE.Mesh(new THREE.BoxGeometry(),m);
 assert.equal(isPhiShadowSurface(mesh(new THREE.MeshStandardMaterial())),true);
 assert.equal(isPhiShadowSurface(mesh(new THREE.MeshBasicMaterial())),false);
 assert.equal(isPhiShadowSurface(mesh(new THREE.MeshStandardMaterial({transparent:true,opacity:.28,depthWrite:false}))),false);
 const water=mesh(new THREE.MeshStandardMaterial());water.name='phi-spiral-reflecting-water';
 assert.equal(isPhiShadowSurface(water),false);
});

test('shadows cache static maps and reuse two room map slots across floors',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),renderer={shadowMap:{}};
 const sun=new THREE.DirectionalLight();sun.position.set(-18,30,12);scene.add(sun);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());scene.add(mesh);
 const roomLights=Array.from({length:4},(_,i)=>{const l=new THREE.SpotLight();l.name='phi-shadow-room-light';l.position.set(i*5,3,0);scene.add(l,l.target);return l;});
 const helper=createPhiShadows({THREE,renderer,scene,camera});helper.update(0);
 assert.equal(helper.stats.roomLights,2);assert.equal(roomLights.filter(l=>l.castShadow).length,2);
 const shadowSlots=roomLights.filter(l=>l.castShadow).map(l=>l.shadow);
 const count=helper.stats.mapRefreshes;helper.update(300);assert.equal(helper.stats.mapRefreshes,count);
 const next=new THREE.SpotLight();next.name='phi-shadow-room-light';scene.remove(...roomLights);scene.add(next,next.target);
 helper.editionChanged(62);helper.update(600);
 assert.ok(shadowSlots.includes(next.shadow));assert.equal(sun.position.y-sun.target.position.y,30);
 assert.equal(sun.position.y,92);assert.equal(helper.stats.roomLights,1);
 assert.equal(mesh.receiveShadow,true);helper.dispose();
});
