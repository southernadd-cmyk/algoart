import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import {planCityBackdrop,addProceduralBackdrop} from '../gallery/visit/procedural-backdrop.mjs';
test('the distant city is a repeatable arrangement of buildings and trees',()=>{
 const plan=planCityBackdrop();assert.deepEqual(planCityBackdrop(),plan);assert.notDeepEqual(planCityBackdrop('another-city'),plan);
 assert.equal(plan.layers.length,3);
 for(const layer of plan.layers){assert.ok(layer.buildings.length>25);assert.equal(layer.trees.length,20);
  for(const b of layer.buildings){assert.ok(Number.isFinite(b.x)&&b.x>=-.025&&b.x<1);assert.ok(b.width>0&&b.height>0&&b.base-b.height>0&&b.base<.5);}
 }
});
test('the city uses small UV-mapped cards and shares its resources across floor changes',()=>{
 const previous=globalThis.document;
 const context={fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},ellipse(){},drawImage(){},createLinearGradient(){return{addColorStop(){}};}};
 globalThis.document={createElement(name){assert.equal(name,'canvas');return{width:0,height:0,getContext(){return context;}};}};
 try{
  const scene=new THREE.Scene(),first=addProceduralBackdrop(THREE,scene,{centerX:3,centerZ:5}),second=addProceduralBackdrop(THREE,scene,{centerX:3,centerZ:5});
  assert.equal(first.cacheHit,false);assert.equal(second.cacheHit,true);assert.equal(first.textureId,second.textureId);
  assert.equal(first.width,1024);assert.equal(first.height,256);assert.equal(first.pixels,262144);
  const [a,b]=scene.children;assert.equal(a.geometry,b.geometry);assert.equal(a.material,b.material);
  assert.equal(a.material.side,THREE.BackSide);assert.equal(a.material.depthWrite,false);assert.equal(a.material.fog,false);
  assert.equal(a.material.map.mapping,THREE.UVMapping);assert.equal(a.geometry.index.count/3,32);
  assert.ok(a.geometry.userData.galleryPersistent&&a.material.userData.galleryPersistent&&a.material.map.userData.galleryPersistent);
  const mobile=addProceduralBackdrop(THREE,scene,{lowPower:true});assert.equal(mobile.width,512);assert.equal(mobile.height,128);assert.equal(mobile.pixels,65536);
  assert.equal(1024*512/mobile.pixels,8);assert.equal(2048*1024/first.pixels,8);
 }finally{globalThis.document=previous;}
});
test('the active environment and bundle no longer load a photographic panorama',()=>{
 const environment=fs.readFileSync('gallery/visit/environment-render.mjs','utf8'),bundle=fs.readFileSync('gallery/visit/gallery-bundle.js','utf8');
 assert.doesNotMatch(environment,/loadSquarePanorama|panorama-backdrop\.mjs/);assert.match(environment,/scene\.fog=null/);
 assert.doesNotMatch(bundle,/day-environment-hdri-101-(?:1k|2k)\.jpg/);
});
