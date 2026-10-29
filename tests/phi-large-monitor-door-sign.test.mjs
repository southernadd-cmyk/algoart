import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {planPhiReception} from '../gallery/visit/phi-reception-layout.mjs';
import {planPhiReceptionMonitorWall} from '../gallery/visit/phi-reception-living-monitor.mjs';
import {planPhiLargeMonitorDoorSign} from '../gallery/visit/phi-translation-area-sign.mjs';

test('the new chalkboard is in main reception, outside the real two-screen room door',()=>{
 globalThis.__phiReceptionTestRefresh=true;
 try{
  const phi=buildPhiRendererPlan('__phi_reception__',
   Array.from({length:10},(_,i)=>({id:String(i),portrait:i%3===0,aspect:i%3===0?.75:1.4})));
  const furnishing=planPhiReception(phi.floor,phi.circulation,phi.physical);
  const monitorRoom=furnishing.backrooms[0];
  const rearRoom=furnishing.backrooms.find(candidate=>candidate!==monitorRoom&&
   Math.hypot(candidate.x-monitorRoom.x,candidate.z-monitorRoom.z)>
     Math.max(2.2,Math.min(candidate.width,candidate.depth))&&
   planPhiReceptionMonitorWall(candidate,furnishing.lift,phi.physical.walls)?.fromPhysical);
  assert.ok(rearRoom,'Expect a second physical monitor backroom');
  const placement=planPhiLargeMonitorDoorSign({rearRoom,
   foyerRoomIndex:furnishing.desk.room,doors:phi.circulation.doors,
   floor:phi.floor,physicalWalls:phi.physical.walls});
  assert.ok(placement,'Main-reception-side doorway sign must be placed');
  assert.equal(placement.zone,'reception-large-monitor-room-door');
  assert.equal(placement.rearRoom,rearRoom.room);
  assert.equal(placement.foyerRoom,furnishing.desk.room);
  assert.ok(placement.doorRooms.includes(rearRoom.room));
  assert.ok(placement.doorRooms.includes(furnishing.desk.room));
  assert.ok(placement.lateralClearance>=.35);
  assert.ok(phi.canWalk(placement.x,placement.z),'Placement must avoid solid walls');
  assert.ok(phi.floor.mergedRooms[furnishing.desk.room].pieces.some(p=>
   placement.x>=p.x+.4&&placement.x<=p.x+p.w-.4&&
   placement.z>=p.z+.4&&placement.z<=p.z+p.h-.4),'A-frame must be IN the foyer');
  const fromDoor={x:placement.x-placement.door.x,z:placement.z-placement.door.z};
  assert.ok(fromDoor.x*placement.normal.x+fromDoor.z*placement.normal.z>.8,
   'The sign belongs on the reception side');
  assert.ok(Math.abs(placement.normal.x-Math.sin(placement.yaw))<1e-9);
  assert.ok(Math.abs(placement.normal.z-Math.cos(placement.yaw))<1e-9);
  assert.ok(placement.distanceToDoor<3.0,'Sign must be recognisably beside the door');
 }finally{delete globalThis.__phiReceptionTestRefresh;}
});

test('no fabricated doorway or incorrectly sided sign',()=>{
 assert.equal(planPhiLargeMonitorDoorSign({rearRoom:null}),null);
 assert.equal(planPhiLargeMonitorDoorSign({rearRoom:{room:1},foyerRoomIndex:0,
  floor:{mergedRooms:[{pieces:[]}]},doors:[]}),null);
});
