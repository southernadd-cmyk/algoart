import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {planPhiCaptionAtlases,phiCaptionAtlasUv,batchPhiPaintingCaptions} from '../test/virtual-gallery/phi-caption-batch.mjs';

test('atlas chunks by renderer texture limit and includes every painting',()=>{
 const layouts=planPhiCaptionAtlases(37,{maxTextureSize:2048});
 assert.ok(layouts.length>1);
 assert.equal(layouts.reduce((n,b)=>n+b.slots.length,0),37);
 for(const a of layouts){
  assert.ok(a.width<=2048&&a.height<=2048);
  for(const slot of a.slots){
   for(const [u,v] of [[0,0],[0,1],[1,0],[1,1]]){
    const [x,y]=phiCaptionAtlasUv(u,v,slot,a);
    assert.ok(x>=0&&x<=1&&y>=0&&y<=1);
   }
  }
 }
 assert.equal(planPhiCaptionAtlases(3,{maxTextureSize:800}).length,0);
});

test('painting captions retain their exact 3D vertices while draw calls and textures fall',()=>{
 const previous=globalThis.document;
 let drawCalls=0;
 globalThis.document={createElement(name){
  assert.equal(name,'canvas');
  return {width:0,height:0,getContext:()=>({drawImage(){drawCalls++;}})};
 }};
 try{
  const scene=new THREE.Scene(),captions=[],beforePositions=[];
  for(let i=0;i<6;i++){
   const image={width:900,height:210};
   const texture=new THREE.CanvasTexture(image);
   const geometry=new THREE.PlaneGeometry(1.12,.26);
   const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide}));
   mesh.position.set(i*1.7,2.1,-i*.5);
   mesh.rotation.y=i%2?Math.PI/2:0;
   mesh.updateMatrix();
   const transformed=geometry.clone().applyMatrix4(mesh.matrix).getAttribute('position');
   for(let j=0;j<transformed.count;j++)beforePositions.push(transformed.getX(j),transformed.getY(j),transformed.getZ(j));
   scene.add(mesh);captions.push(mesh);
  }
  const stats=batchPhiPaintingCaptions(THREE,scene,captions,{maxTextureSize:4096});
  assert.equal(stats.active,true);
  assert.equal(stats.original,6);
  assert.equal(stats.batched,1);
  assert.equal(stats.drawCallsSaved,5);
  assert.ok(drawCalls>=6);
  assert.equal(scene.children.length,1);
  const merged=scene.children[0].geometry.getAttribute('position');
  const afterPositions=Array.from(merged.array);
  assert.equal(afterPositions.length,beforePositions.length);
  for(let i=0;i<afterPositions.length;i++)assert.ok(Math.abs(afterPositions[i]-beforePositions[i])<.00001);
 }finally{globalThis.document=previous;}
});

test('atlas failures leave all original painting captions mounted',()=>{
 const scene=new THREE.Scene();
 const a=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());
 const b=a.clone();scene.add(a,b);
 const stats=batchPhiPaintingCaptions(THREE,scene,[a,b],{maxTextureSize:800});
 assert.equal(stats.active,false);
 assert.deepEqual(scene.children,[a,b]);
});
