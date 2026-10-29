import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addPhiDeskHologram} from '../gallery/visit/phi-desk-hologram.mjs';
const floors=()=>[
 [[12,.25,9,0,-.16,0,0],[.2,5.2,9,-6,2.6,0,0]],
 [[8,.25,6,2,5.84,-1,2.399963229728653],[.2,5.2,6,2,8.6,-1,2.399963229728653]]
];
function dispose(h){h.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});h.root.removeFromParent();}
test('desk hologram includes every exact floor box and keeps the source yaw, dimensions and position',()=>{
 const desk=new THREE.Group(),floorBoxes=floors();
 const h=addPhiDeskHologram(THREE,desk,{floorBoxes,signature:'two floors'});
 try{
  assert.equal(h.root.parent,desk);assert.equal(h.diagnostics.floorCount,2);assert.equal(h.diagnostics.boxes,4);
  assert.deepEqual(h.root.position.toArray(),[1.55,1.126,-.40],'front corner on the R side of the Reception sign');
  const mesh=h.model.children.find(o=>o.name==='archived-tower-static-batch');
  const pos=mesh.geometry.getAttribute('position'),unit=new THREE.BoxGeometry(1,1,1).getAttribute('position');
  floorBoxes.flat().forEach(([w,height,d,x,y,z,yaw],i)=>{
   for(let v=0;v<24;v++){
    const px=unit.getX(v)*w,pz=unit.getZ(v)*d;
    const expected=[x+px*Math.cos(yaw)+pz*Math.sin(yaw),y+unit.getY(v)*height,z-px*Math.sin(yaw)+pz*Math.cos(yaw)];
    [pos.getX(i*24+v),pos.getY(i*24+v),pos.getZ(i*24+v)].forEach((n,j)=>assert.ok(Math.abs(n-expected[j])<1e-5));
   }
  });
  assert.ok(h.diagnostics.height<=.950001);assert.ok(Math.max(h.diagnostics.width,h.diagnostics.depth)<=.720001);
  desk.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(h.model);
  assert.ok(Math.abs(bounds.min.y-(1.126+.15))<1e-6,'floats above the projector');
  assert.equal(h.model.rotation.y,0,'orientation stays aligned to real tower');
 }finally{dispose(h);}
});
test('daily rebuild includes new floors and copies shaft geometry without modifying the real shell',()=>{
 const shaft=new THREE.BoxGeometry(2,20,2),desk=new THREE.Group(),input=floors(),original=JSON.stringify(input);
 const a=addPhiDeskHologram(THREE,desk,{floorBoxes:input,shaftGeometry:shaft,signature:'day one'});
 const b=addPhiDeskHologram(THREE,desk,{floorBoxes:[...input,[[7,.25,5,1,18,0,4.8]]],shaftGeometry:shaft,signature:'day two'});
 try{
  assert.equal(a.diagnostics.floorCount,2);assert.equal(b.diagnostics.floorCount,3);
  assert.equal(b.diagnostics.boxes,a.diagnostics.boxes+1);assert.equal(b.diagnostics.signature,'day two');
  assert.equal(JSON.stringify(input),original);
  const miniatureShaft=a.model.getObjectByName('hologram-lift-shaft');
  assert.notEqual(miniatureShaft.geometry,shaft);
  assert.deepEqual(miniatureShaft.geometry.getAttribute('position').array,shaft.getAttribute('position').array);
  const before=miniatureShaft.material.opacity;a.update(1);
  assert.notEqual(miniatureShaft.material.opacity,before);assert.ok(miniatureShaft.material.opacity>0);
  assert.ok(a.diagnostics.drawCalls<=8,'bounded draw calls independent of number of floors');
 }finally{dispose(a);dispose(b);shaft.dispose();}
});
test('reception integration takes complete data from the real shell, including cached return visits',()=>{
 const source=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.match(source,/hologramFloors\.at\(-1\)\.push\(\[w,h,d,hologramPosition\.x,y,hologramPosition\.z,shellTransform\.theta\]\)/);
 assert.match(source,/floorBoxes:cache\.hologramFloors,shaftGeometry:cache\.shaftGeometry,signature:cache\.signature/);
 assert.ok(source.indexOf('if(plan.phi)constructPhiTowerShell();')<source.indexOf('phiReceptionDesk.hologram=addPhiDeskHologram'));
 assert.match(source,/phiReceptionDesk\?\.hologram\?\.update\(clock\.elapsedTime\)/);
 assert.equal(addPhiDeskHologram(THREE,new THREE.Group(),{floorBoxes:[]}),null);
});
