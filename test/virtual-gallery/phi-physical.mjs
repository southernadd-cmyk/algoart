// Physical circulation prototype. Geometry is in metres; no Three.js dependency.
export const WALK_RADIUS=.38;
const EPS=1e-5;
const span=(a,b)=>[Math.max(a[0],b[0]),Math.min(a[1],b[1])];
function subtract(intervals,cut){
 return intervals.flatMap(([lo,hi])=> {
  const [a,b]=span([lo,hi],cut);
  return b-a<=EPS?[[lo,hi]]:[[lo,a],[b,hi]].filter(([x,y])=>y-x>EPS);
 });
}
export function buildPhysicalPhiFloor(plan,circulation){
 const owner=new Map(plan.mergedRooms.flatMap((r,i)=>r.cells.map(id=>[id,i])));
 const walls=[];
 for(const cell of plan.rooms){
  const edges=[
   {axis:'x',at:cell.x,lo:cell.z,hi:cell.z+cell.h},
   {axis:'x',at:cell.x+cell.w,lo:cell.z,hi:cell.z+cell.h},
   {axis:'z',at:cell.z,lo:cell.x,hi:cell.x+cell.w},
   {axis:'z',at:cell.z+cell.h,lo:cell.x,hi:cell.x+cell.w}
  ];
  for(const edge of edges){
   let intervals=[[edge.lo,edge.hi]];
   // Remove only the part of an edge facing another cell of the same room.
   for(const other of plan.rooms){
    if(other.id===cell.id||owner.get(other.id)!==owner.get(cell.id))continue;
    const aligned=edge.axis==='x'?
      Math.abs(other.x-edge.at)<EPS||Math.abs(other.x+other.w-edge.at)<EPS:
      Math.abs(other.z-edge.at)<EPS||Math.abs(other.z+other.h-edge.at)<EPS;
    if(aligned)intervals=subtract(intervals,edge.axis==='x'?[other.z,other.z+other.h]:[other.x,other.x+other.w]);
   }
   for(const door of [...circulation.doors,...(circulation.bridgePortals||[])])if(door.axis===edge.axis&&Math.abs(door.at-edge.at)<EPS){
    intervals=subtract(intervals,[door.centre-door.width/2,door.centre+door.width/2]);
   }
   for(const [lo,hi] of intervals)if(hi-lo>EPS)walls.push({...edge,lo,hi,room:owner.get(cell.id)});
  }
 }
 // Duplicate shared boundaries are harmless but wasteful; canonicalize.
 const unique=new Map();
 for(const wall of walls){const key=[wall.axis,...[wall.at,wall.lo,wall.hi].map(x=>x.toFixed(5))].join('|');unique.set(key,wall);}
 const physicalWalls=[...unique.values()];
 const sculptures=plan.mergedRooms.map((room,i)=>{
  const piece=[...room.pieces].sort((a,b)=>b.w*b.h-a.w*a.h)[0];
  const area=piece.w*piece.h;
  if(area<38||Math.min(piece.w,piece.h)<5)return null;
  const x=piece.x+piece.w*.61803398875,z=piece.z+piece.h*.61803398875;
  // Leave a clear central passage. Small display objects only at this stage.
  return {room:i,x,z,width:.9,depth:.9};
 }).filter(Boolean);
 function within(x,z,r=WALK_RADIUS){
  return plan.rooms.some(c=>x>=c.x+r-EPS&&x<=c.x+c.w-r+EPS&&z>=c.z+r-EPS&&z<=c.z+c.h-r+EPS)||
   [...circulation.doors,...(circulation.bridgePortals||[])].some(d=>d.axis==='x'?
     Math.abs(x-d.at)<=r&&Math.abs(z-d.centre)<=d.width/2-r:
     Math.abs(z-d.at)<=r&&Math.abs(x-d.centre)<=d.width/2-r);
 }
 function walkable(x,z,r=WALK_RADIUS){
  if(!within(x,z,r)&&!(circulation.bridges||[]).some(b=>b.axis==='x'?x>=b.from-r&&x<=b.to+r&&Math.abs(z-b.centre)<=b.width/2-r:z>=b.from-r&&z<=b.to+r&&Math.abs(x-b.centre)<=b.width/2-r))return false;
  // Glass deck provides a walkable strip across the otherwise empty court.
  for(const wall of physicalWalls){
   if(wall.axis==='x'&&Math.abs(x-wall.at)<r&&z>wall.lo-r&&z<wall.hi+r)return false;
   if(wall.axis==='z'&&Math.abs(z-wall.at)<r&&x>wall.lo-r&&x<wall.hi+r)return false;
  }
  for(const s of sculptures)if(Math.abs(x-s.x)<s.width/2+r&&Math.abs(z-s.z)<s.depth/2+r)return false;
  return true;
 }
 // Find traversable door centres and prove clearance on both sides.
 const transitions=circulation.doors.map(d=>{
  const center=d.axis==='x'?{x:d.at,z:d.centre}:{x:d.centre,z:d.at};
  const offset=WALK_RADIUS*1.6;
  const sides=d.axis==='x'?
   [{x:d.at-offset,z:d.centre},{x:d.at+offset,z:d.centre}]:
   [{x:d.centre,z:d.at-offset},{x:d.centre,z:d.at+offset}];
  return {...center,valid:walkable(center.x,center.z)&&sides.every(p=>walkable(p.x,p.z))};
 });
 return {walls:physicalWalls,sculptures,transitions,walkable,wallCount:physicalWalls.length,
  checks:{doorsClear:transitions.every(t=>t.valid),liftInside:walkable(circulation.lift.x,circulation.lift.z),noSculptureWalls:sculptures.every(s=>walkable(s.x+s.width/2+.6,s.z))}};
}
