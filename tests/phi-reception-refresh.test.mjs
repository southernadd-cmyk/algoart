import {readFileSync} from 'node:fs';
import test from 'node:test';import assert from 'node:assert/strict';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';import {planPhiReception} from '../gallery/visit/phi-reception-layout.mjs';
import {planPhiReceptionMonitorWall} from '../gallery/visit/phi-reception-living-monitor.mjs';
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

test('test reception locates three living monitors on a solid backroom wall facing the lift',()=>{
 globalThis.__phiReceptionTestRefresh=true;
 try{
  const phi=buildPhiRendererPlan('__phi_reception__',Array.from({length:10},(_,i)=>({id:String(i),portrait:i%3===0,aspect:i%3===0?.75:1.4})));
  const furnishing=planPhiReception(phi.floor,phi.circulation,phi.physical);
  assert.ok(furnishing.backrooms.length>0,'The test layout needs an actual backroom, not a fallback room');
  const mount=planPhiReceptionMonitorWall(furnishing.backrooms[0],furnishing.lift,phi.physical.walls);
  assert.ok(mount,'Three monitors must have a mountable back wall');
  assert.equal(mount.fromPhysical,true,'Monitors should use physical wall segments, not a guessed rectangle');
  assert.ok(mount.width>=.35,'Three monitors must fit the selected wall');
  const room=furnishing.backrooms[0];
  const aim={x:furnishing.lift.x-room.x,z:furnishing.lift.z-room.z};
  const dot=mount.normal.x*aim.x+mount.normal.z*aim.z;
  assert.ok(dot>=0,'Screens must face towards the lift');
  assert.ok((3*mount.width+2*mount.gap)<=mount.span-.20,'All three screens must fit without overlapping a doorway');
 }finally{delete globalThis.__phiReceptionTestRefresh;}
});


test('live and test share charcoal exterior brick on reception feature walls, with truthful active credits',()=>{
 const src=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 const wallpaper=readFileSync(new URL('../gallery/visit/reception-wall-material.mjs',import.meta.url),'utf8');
 const panels=readFileSync(new URL('../gallery/visit/phi-reception-decor.mjs',import.meta.url),'utf8');
 const live=readFileSync(new URL('../gallery/visit/credits.html',import.meta.url),'utf8');
 const staging=readFileSync(new URL('../test/virtual-gallery/credits.html',import.meta.url),'utf8');
 assert.match(src,/const receptionBlackBrickMaterial=galleryFinish\.exteriorBrick;/);
 assert.ok(src.includes('receptionBlackBrickMaterial,receptionWallMaterial'));
 assert.ok(src.includes('receptionWallMaterial,receptionBlackBrickMaterial'));
 assert.doesNotMatch(wallpaper,/ambientcg-painted-plaster-007|PaintedPlaster007/);
 for(const page of [panels,live,staging]){
  assert.match(page,/Bricks055/);
  assert.doesNotMatch(page,/PaintedPlaster007/);
 }
 assert.doesNotMatch(staging,/Vintage Framed World Map|Small succulent in planter/);
});
