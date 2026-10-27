import test from 'node:test';import assert from 'node:assert/strict';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';import {planPhiReception} from '../gallery/visit/phi-reception-layout.mjs';
test('the test reception poster is visually left of the map and workrooms stay out of the public foyer',()=>{
 globalThis.__phiReceptionTestRefresh=true;
 try{
  const p=buildPhiRendererPlan('__phi_reception__',Array.from({length:10},(_,i)=>({id:String(i),portrait:i%3===0,aspect:i%3===0?.75:1.4})));
  const r=planPhiReception(p.floor,p.circulation,p.physical),poster=r.signage[1],map=r.worldMap;
  assert.ok((poster.x-map.x)*-map.normal.z>(map.width+poster.width)/2,'Poster must be on the viewer’s left with a clear gap');
  assert.ok(r.backrooms.every(room=>room.room!==r.desk.room),'Public foyer must not be filled with storage workbenches');
  const position={x:r.desk.x+4.4,z:r.desk.z+2.35};
  for(const [dx,dz] of [[-.625,-.425],[-.625,.425],[.625,-.425],[.625,.425]])assert.ok(p.canWalk(position.x+dx,position.z+dz),'Gramophone must fit its room');
  assert.ok(Math.hypot(position.x-r.entrance.x,position.z-r.entrance.z)>3);
 }finally{delete globalThis.__phiReceptionTestRefresh;}
});
