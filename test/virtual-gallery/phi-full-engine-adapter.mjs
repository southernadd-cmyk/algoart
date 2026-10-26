// Test-only bridge from golden-ratio plans to the full exhibition renderer.
// Coordinates and surfaces are the authoritative physical geometry: do not
// approximate the floor with legacy rectangular galleries.
import {planPhiFloor} from '../../gallery/visit/phi-architecture.mjs';
import {planPhiBridges} from '../../gallery/visit/phi-bridges.mjs';
import {planPhiCirculation} from '../../gallery/visit/phi-circulation.mjs';
import {buildPhysicalPhiFloor,WALK_RADIUS} from '../../gallery/visit/phi-physical.mjs';
import {planCuratedPhiExhibition} from '../../gallery/visit/phi-curator.mjs';

export function buildPhiRendererPlan(date,studies,{variation=0}={}){
 const planningDate=date==='__phi_reception__'?'2026-10-05':date;
 const subdivision=planPhiFloor(planningDate,{artworks:studies.length,variation});
 const {plan:floor,bridges,voids}=planPhiBridges(subdivision);
 const circulation=planPhiCirculation(floor);
 circulation.bridges=bridges;
 circulation.bridgePortals=bridges.flatMap(b=>[
  {axis:b.axis,at:b.from,centre:b.centre,width:b.width},
  {axis:b.axis,at:b.to,centre:b.centre,width:b.width}
 ]);
 // Reserve a dedicated external lift vestibule, rather than putting the
 // cabin in a gallery corner or competing with an artwork wall.
 const entranceCell=floor.rooms.find(p=>Math.abs(p.x-floor.root.x)<.01&&p.z<=floor.root.z+2.2&&p.z+p.h>=floor.root.z+2.2)||floor.rooms[0];
 const portal={axis:'x',at:entranceCell.x,centre:entranceCell.z+Math.min(entranceCell.h/2,2.2),width:2.4};
 circulation.bridgePortals.push(portal);
 circulation.lift={x:portal.at-2.25,z:portal.centre,room:0,external:true,portal};
 // Reception has a separate south-side public door, distinct from west lift.
 if(date==='__phi_reception__'){
   const first=floor.rooms[0];
   const entrance={axis:'z',at:first.z,centre:first.x+first.w/2,width:2.6,public:true};
   circulation.bridgePortals.push(entrance);
   circulation.publicEntrance=entrance;
 }
 const physical=buildPhysicalPhiFloor(floor,circulation);
 const exhibition=planCuratedPhiExhibition(floor,circulation,physical,studies);
 const pieces=floor.mergedRooms.flatMap((room,i)=>room.pieces.map(p=>({...p,room:i})));
 const portals=[...circulation.doors,...circulation.bridgePortals];
 // Do not shrink individual golden cells: their internal seams are not walls.
 // Collision against the physical wall segments provides the visitor clearance.
 const inside=(x,z)=>pieces.some(p=>x>=p.x&&x<=p.x+p.w&&z>=p.z&&z<=p.z+p.h);
 const overBridge=(x,z,pad=WALK_RADIUS)=>bridges.some(b=>
  b.axis==='x'
   ?x>=Math.min(b.from,b.to)-.1&&x<=Math.max(b.from,b.to)+.1&&Math.abs(z-b.centre)<=b.width/2-pad
   :z>=Math.min(b.from,b.to)-.1&&z<=Math.max(b.from,b.to)+.1&&Math.abs(x-b.centre)<=b.width/2-pad);
 const nearPortal=(x,z)=>portals.some(d=>d.axis==='x'?
   Math.abs(x-d.at)<=1.05&&Math.abs(z-d.centre)<d.width/2-WALK_RADIUS:
   Math.abs(z-d.at)<=1.05&&Math.abs(x-d.centre)<d.width/2-WALK_RADIUS);
 const lobby=circulation.lift;
 const inLiftLobby=(x,z)=>x>=lobby.x-1.45&&x<=lobby.portal.at+.42&&Math.abs(z-lobby.z)<=1.2-WALK_RADIUS;
 const wallCollision=(x,z)=>physical.walls.some(w=>w.axis==='x'?
   Math.abs(x-w.at)<WALK_RADIUS&&z>=w.lo-WALK_RADIUS&&z<=w.hi+WALK_RADIUS:
   Math.abs(z-w.at)<WALK_RADIUS&&x>=w.lo-WALK_RADIUS&&x<=w.hi+WALK_RADIUS);
 // A doorway remains traversable along its approach, not just within a
 // thin collar at the boundary. Walls themselves are still authoritative.
 const canWalk=(x,z)=> (inside(x,z)||overBridge(x,z)||nearPortal(x,z)||inLiftLobby(x,z))&&!wallCollision(x,z);
 const placed=[...exhibition.paintings,...exhibition.sculptures];
 const ids=placed.map(p=>p.studyId);
 const checks={
  connected:circulation.connected,
  count:placed.length+exhibition.unplaced.length===studies.length,
  unique:new Set(ids).size===ids.length,
  inwardFacing:exhibition.checks.inwardFacing,
  clearances:exhibition.checks.sculptureClearances,
  unplaced:exhibition.unplaced.length
 };
 return {date,floor,bridges,voids,circulation,physical,exhibition,pieces,canWalk,checks};
}
