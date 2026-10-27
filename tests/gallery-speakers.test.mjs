import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as THREE from 'three';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {planGallerySpeakers,addGalleryCeilingSpeaker,createGallerySpeakerFeed} from '../gallery/visit/gallery-speakers.mjs';
import {createGramophoneRecord} from '../gallery/visit/gramophone-record.mjs';
import {addPhiReceptionGramophone} from '../gallery/visit/phi-reception-gramophone.mjs';
class Media extends EventTarget{constructor(){super();this.starts=0;this.loads=0;this.currentTime=0;this.paused=true;}load(){this.loads++;}async play(){this.starts++;this.paused=false;}pause(){this.paused=true;}removeAttribute(name){delete this[name];}}
function model(){const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.6),new THREE.MeshStandardMaterial()));return root;}
test('every actual gallery room gets an unobstructed ceiling mounting away from its central light',()=>{
 for(const date of ['__phi_reception__','2026-10-05','2026-10-14','2026-10-26']){
  const phi=buildPhiRendererPlan(date,Array.from({length:date==='__phi_reception__'?10:18},(_,i)=>({id:String(i),portrait:i%3===0,aspect:i%3===0?.75:1.4})));
  const mounts=planGallerySpeakers(phi.floor.mergedRooms,{elevation:12.4});assert.equal(mounts.length,phi.floor.mergedRooms.length);
  for(const [i,p] of mounts.entries()){
   const room=phi.floor.mergedRooms[i];assert.ok(room.pieces.some(c=>p.x-p.diameter/2>c.x&&p.x+p.diameter/2<c.x+c.w&&p.z-p.diameter/2>c.z&&p.z+p.diameter/2<c.z+c.h));
   const cell=room.pieces.reduce((a,b)=>a.w*a.h>b.w*b.h?a:b);assert.ok(Math.hypot(p.x-cell.x-cell.w/2,p.z-cell.z-cell.h/2)>.5);assert.ok(Math.abs(p.y-17.602)<1e-6);
  }
 }
});
test('a single record and playhead survive reception removal, a moving lift and another gallery',async()=>{
 const audio=new Media(),record=createGramophoneRecord({audio});await record.play();audio.dispatchEvent(new Event('ended'));await Promise.resolve();audio.currentTime=84.25;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),canvas=new EventTarget();
 const reception=addPhiReceptionGramophone(THREE,scene,{furnishing:{desk:{x:0,z:0}},elevation:0,camera,canvas,timber:new THREE.MeshStandardMaterial(),trims:new THREE.MeshStandardMaterial(),music:{record,open(){}},loadAsset:async()=>model()});
 const pos=new THREE.Vector3(),feed=createGallerySpeakerFeed(record,{positionOf:o=>o.getWorldPosition(pos)});feed.setEmitters([reception.emitter]);feed.update({x:4.4,y:0,z:2.35});
 const src=audio.src,starts=audio.starts,loads=audio.loads;reception.dispose();scene.remove(reception.root);assert.equal(audio.paused,false);
 const cabin=new THREE.Group();scene.add(cabin);const speaker=await addGalleryCeilingSpeaker(THREE,cabin,{y:2.962,diameter:.25,loadAsset:async()=>model()});await speaker.userData.ready;feed.setEmitters([speaker]);
 for(const height of [0,6.2,12.4,74.4]){cabin.position.y=height;feed.update({x:0,y:height,z:0});assert.ok(audio.volume>.4,'Cabin audio must travel with the listener');}
 const destination=new THREE.Object3D();destination.position.set(5,79.6,3);scene.add(destination);feed.setEmitters([destination]);feed.update({x:5,y:74.4,z:3});
 assert.equal(audio.currentTime,84.25);assert.equal(audio.src,src);assert.equal(audio.starts,starts);assert.equal(audio.loads,loads);assert.equal(record.state().index,1);assert.equal(audio.paused,false);
 feed.setVolume(.2);assert.ok(Math.abs(audio.volume-.2)<1e-6);record.pause();feed.setEmitters([speaker]);feed.update({x:0,y:74.4,z:0});assert.equal(audio.paused,true,'Changing floor must never restart a paused record');record.dispose();
});
test('late speaker downloads cannot add fittings to a departed floor',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r),scene=new THREE.Scene();const speaker=addGalleryCeilingSpeaker(THREE,scene,{y:5.202,loadAsset:()=>pending});scene.remove(speaker);speaker.userData.galleryDisposed=true;
 resolve(model());await speaker.userData.ready;assert.equal(speaker.userData.modelLoaded,undefined);assert.equal(speaker.children.length,1);
});
test('the uploaded speaker is credited, grille-down and recessed within both ceiling slabs',()=>{
 const b=readFileSync(new URL('../gallery/visit/models/ceiling-speaker.glb',import.meta.url)),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 assert.match(j.asset.extras.author,/spy_dogg/);assert.match(j.asset.extras.license,/CC-BY-4.0/);assert.deepEqual(j.accessors[0].min,[-.5,0,-.5]);assert.equal(j.nodes.length,1);
 const thickness=j.accessors[0].max[1];assert.ok(thickness*.32-.008<.18);assert.ok(thickness*.25-.008<.1);assert.ok(b.length<500000);
});
