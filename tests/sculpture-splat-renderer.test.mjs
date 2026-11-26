import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSculptureSplatRenderer} from '../gallery/sculpture-splats/renderer.mjs';
function fixture({badPack=false,badRuntime=false}={}){
 const scene=new THREE.Scene(),workshop=new THREE.Group(),renderer={xr:{isPresenting:false}};
 let loads=0,runtimes=0,disposed=0;
 class SparkRenderer extends THREE.Group{constructor(){super();runtimes++;}}
 class SplatMesh extends THREE.Group{
  constructor({constructSplats}){super();let n=0;constructSplats({pushSplat(){n++;}});assert.equal(n,4);this.initialized=Promise.resolve();}
  dispose(){disposed++;}
 }
 const pack={studies:{'a.jpg':{seed:'seed',originalTriangles:1,meshCounts:[[3,3]],materialCounts:[1],points:Float32Array.from(Array.from({length:4},()=>[0,0,0,0,0,1,.5,.5,.01,0,0]).flat())}}};
 const manager=createSculptureSplatRenderer({THREE,renderer,scene,loadSpark:async()=>{if(badRuntime)throw Error('Spark unavailable');return {SparkRenderer,SplatMesh};},loadPack:async()=>{loads++;if(badPack)throw Error('Missing pack');return pack;}});
 function sculpture(parent=scene){
  const pivot=new THREE.Group(),body=new THREE.Group(),fixture=new THREE.Group();
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));geometry.setIndex([0,1,2]);
  const mesh=new THREE.Mesh(geometry,[new THREE.MeshStandardMaterial({color:'#aaaaaa'})]);
  parent.add(pivot);pivot.add(body,fixture);body.add(mesh);body.userData.polygonTriangles=1;
  return {body,pivot,fixture,mesh,date:'2026-11-26',quality:'mobile',name:'a.jpg',seed:'seed',sourceSha256:'a'.repeat(64)};
 }
 return {scene,workshop,renderer,manager,sculpture,counts:()=>({loads,runtimes,disposed})};
}
test('GS3 preserves transform/support and restores original mesh in XR, reusing one Spark and pack',async()=>{
 const f=fixture(),a=f.sculpture(),b=f.sculpture(f.workshop);
 a.body.position.y=2;a.pivot.rotation.y=.7;
 assert.equal(await f.manager.enhance(a),true);assert.equal(await f.manager.enhance(b),true);
 assert.equal(a.mesh.visible,false);assert.equal(b.mesh.visible,true);
 assert.equal(a.body.position.y,2);assert.equal(a.pivot.rotation.y,.7);assert.equal(a.fixture.visible,true);
 assert.equal(f.manager.stats().active,1);assert.deepEqual(f.counts(),{loads:1,runtimes:1,disposed:0});
 f.scene.add(b.pivot);f.manager.beforeRender();assert.equal(b.mesh.visible,false);
 f.renderer.xr.isPresenting=true;f.manager.beforeRender();
 assert.equal(a.mesh.visible,true);assert.equal(b.mesh.visible,true);assert.equal(f.manager.stats().active,0);
 f.renderer.xr.isPresenting=false;f.manager.beforeRender();assert.equal(f.manager.stats().active,2);
 a.body.userData.disposeSculptureSplats();assert.equal(a.mesh.visible,true);
 b.pivot.userData.galleryDisposed=true;f.manager.beforeRender();
 assert.equal(f.manager.stats().ready,0);assert.equal(f.counts().disposed,2);
});
test('GS3 falls back without hiding geometry if pack, source or Spark fails',async()=>{
 for(const config of [{badPack:true},{badRuntime:true},{}]){
  const f=fixture(config),s=f.sculpture();
  if(!config.badPack&&!config.badRuntime)s.seed='mismatch';
  assert.equal(await f.manager.enhance(s),false);assert.equal(s.mesh.visible,true);
  assert.equal(f.manager.stats().active,0);
 }
});
test('GS3 cancellation during asynchronous source preparation leaves no splat or hidden mesh',async()=>{
 const f=fixture(),s=f.sculpture(),pending=f.manager.enhance(s);
 s.pivot.userData.galleryDisposed=true;
 assert.equal(await pending,false);assert.equal(s.mesh.visible,true);assert.equal(f.manager.stats().ready,0);
});

test('GS6 a failed active Spark frame retries with restored meshes and no Spark',async()=>{
 const f=fixture(),s=f.sculpture();
 await f.manager.enhance(s);
 let frames=0;
 f.manager.renderFrame(()=>{frames++;if(frames===1)throw Error('GPU splat failure');assert.equal(s.mesh.visible,true);});
 assert.equal(frames,2);
 assert.equal(f.manager.stats().active,0);
 assert.equal(f.manager.stats().disabled,true);
 assert.match(f.manager.stats().lastError,/GPU splat failure/);
 assert.throws(()=>f.manager.renderFrame(()=>{throw Error('ordinary mesh frame failure');}),/ordinary mesh frame failure/);
});
