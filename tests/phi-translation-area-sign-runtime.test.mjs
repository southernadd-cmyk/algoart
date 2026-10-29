import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addPhiTranslationAreaSign,addPhiLargeMonitorDoorSign} from '../gallery/visit/phi-translation-area-sign.mjs';

// Exercise the production canvas-texture construction path in Node. Earlier
// placement-only tests missed an undefined elevation in the shared builder.
function withCanvasStub(run){
 const original=globalThis.document;
 const g={
  fillRect(){},strokeRect(){},fillText(){},beginPath(){},moveTo(){},
  lineTo(){},stroke(){},closePath(){}
 };
 globalThis.document={createElement(name){
  assert.equal(name,'canvas');
  return {width:0,height:0,getContext(){return g;}};
 }};
 try{return run();}
 finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
}

test('original Translation Area sign builds at requested floor elevation',()=>{
 withCanvasStub(()=>{
  const scene=new THREE.Scene();
  const sign=addPhiTranslationAreaSign(THREE,scene,{
   entrance:{axis:'z',at:0,centre:2,width:2.6},
   gramophone:{x:6.5,z:3},elevation:12
  });
  assert.ok(sign,'original sign was created');
  assert.equal(sign.root.position.y,12.016);
  assert.ok(scene.getObjectByName('phi-translation-area-doorway-sign'));
  sign.dispose();
 });
});

test('second Translation Area sign builds on reception side at requested elevation',()=>{
 withCanvasStub(()=>{
  const scene=new THREE.Scene();
  const sign=addPhiLargeMonitorDoorSign(THREE,scene,{
   rearRoom:{room:1},foyerRoomIndex:0,
   doors:[{a:0,b:1,axis:'x',at:0,centre:0,width:2.4}],
   floor:{mergedRooms:[{pieces:[{x:-5,z:-5,w:5,h:10}]},{pieces:[{x:0,z:-5,w:5,h:10}]}]},
   physicalWalls:[],elevation:18
  });
  assert.ok(sign,'second sign was created');
  assert.equal(sign.root.position.y,18.016);
  assert.ok(scene.getObjectByName('phi-translation-area-large-monitor-entrance-sign'));
  assert.equal(sign.placement.foyerRoom,0);
  sign.dispose();
 });
});
