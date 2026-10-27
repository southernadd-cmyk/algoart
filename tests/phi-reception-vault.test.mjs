import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {planPhiReceptionVault,addPhiTestVault} from '../gallery/visit/phi-test-vault.mjs';
const phi=buildPhiRendererPlan('__phi_reception__',Array.from({length:10},(_,i)=>({id:String(i),portrait:i%3===0,aspect:i%3===0?.75:1.4})));
const plan=planPhiReceptionVault(phi.pieces);
const glb=readFileSync(new URL('../gallery/visit/models/gothic-reception-vault.glb',import.meta.url));
const jsonLength=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+jsonLength));
const binary=glb.subarray(28+jsonLength);
function attribute(index){
 const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView],n=a.type==='SCALAR'?1:Number(a.type.slice(-1)),bytes=a.componentType===5125?Uint32Array:Float32Array;
 const values=[];for(let i=0;i<a.count;i++)for(let k=0;k<n;k++){
  const offset=(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*4)+k*4;
  values.push(a.componentType===5125?binary.readUInt32LE(offset):binary.readFloatLE(offset));
 }
 return new bytes(values);
}
function source(){
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(attribute(0),3));geo.setIndex(new THREE.BufferAttribute(attribute(5),1));
 const root=new THREE.Group();root.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({side:THREE.DoubleSide})));return root;
}
test('continuous vaulted bays cover the entire reception without gaps or overlap',()=>{
 const area=plan.tiles.reduce((n,t)=>n+t.regions.reduce((area,r)=>area+(r.east-r.west)*(r.north-r.south),0),0);
 assert.ok(Math.abs(area-phi.pieces.reduce((n,p)=>n+p.w*p.h,0))<1e-7);
 for(let z=plan.south+.03;z<plan.north;z+=.13)for(let x=plan.west+.03;x<plan.east;x+=.13){
  const expected=phi.pieces.some(p=>x>=p.x&&x<p.x+p.w&&z>=p.z&&z<p.z+p.h)?1:0;
  assert.equal(plan.tiles.flatMap(t=>t.regions).filter(r=>x>=r.west&&x<r.east&&z>=r.south&&z<r.north).length,expected);
 }
 assert.ok(plan.spring>4.658,'Ceiling must clear the existing giant map');
 assert.ok(plan.crown<6.2-.31,'Vault must clear the floor slab above');
 assert.ok(plan.crown<plan.wallHeight+.01,'Roof slab must stay above the vault');
 assert.ok(plan.rise>1,'Vault needs real architectural depth');
});
test('uploaded mesh retains original textured Gothic geometry and embeds both maps',()=>{
 assert.equal(gltf.asset.extras.author,'ramonscortanu (https://sketchfab.com/ramonscortanu)');
 assert.equal(gltf.accessors[0].count,641);assert.equal(gltf.accessors[5].count,2412);
 assert.equal(gltf.images.length,2);assert.ok(gltf.images.every(im=>im.bufferView!==undefined));
 assert.deepEqual(gltf.accessors[0].min,[-.5,0,-.5]);assert.deepEqual(gltf.accessors[0].max,[.5,1,.5]);
});
test('delayed ceiling follows the floor transform and every bay is overhead',async()=>{
 let resolve;const loading=new Promise(r=>resolve=r),scene=new THREE.Scene();
 const root=addPhiTestVault(THREE,scene,{plan,loadAsset:()=>loading});
 assert.equal(root.parent,scene,'Ceiling must attach before async loading');
 root.position.set(17,0,-8);root.rotation.y=.72;
 resolve(source());await root.userData.ready;scene.updateMatrixWorld(true);
 const ceiling=root.getObjectByName('uploaded-gothic-ceiling-tiles');assert.ok(ceiling.geometry.getAttribute('position').count>0);
 assert.ok(!ceiling.geometry.userData.galleryPersistent,'Per-floor geometry must be disposable');
 for(const bay of plan.tiles)for(const r of bay.regions){
  const origin=root.localToWorld(new THREE.Vector3((r.west+r.east)/2,1.8,(r.south+r.north)/2));
  const hit=new THREE.Raycaster(origin,new THREE.Vector3(0,1,0)).intersectObject(ceiling)[0];
  assert.ok(hit,'Uploaded vault must be visible directly overhead');assert.ok(hit.point.y>plan.spring&&hit.point.y<=plan.crown+.001);
 }
 const voidCell=phi.voids[0];
 if(voidCell){const origin=root.localToWorld(new THREE.Vector3(voidCell.x+voidCell.w/2,1.8,voidCell.z+voidCell.h/2));assert.equal(new THREE.Raycaster(origin,new THREE.Vector3(0,1,0)).intersectObject(ceiling).length,0);}
 assert.equal(root.children.filter(o=>o.isLight).length,0);
});
test('a late asset never reappears after leaving the reception',async()=>{
 let resolve;const loading=new Promise(r=>resolve=r),scene=new THREE.Scene();
 const root=addPhiTestVault(THREE,scene,{plan,loadAsset:()=>loading});scene.remove(root);root.userData.galleryDisposed=true;
 resolve(source());await root.userData.ready;assert.equal(scene.children.length,0);assert.equal(root.children.length,0);
});
