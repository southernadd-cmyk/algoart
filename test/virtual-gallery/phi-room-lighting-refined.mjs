// Staging refinement: geometry determines direction; area determines smooth weight.
import {PHI} from '../../gallery/visit/phi-room-lighting.mjs';
const point=portal=>portal.axis==='x'?{x:portal.at,z:portal.centre}:{x:portal.centre,z:portal.at};
const distanceToRoom=(room,p)=>Math.min(...room.pieces.map(c=>Math.max(c.x-p.x,0,p.x-c.x-c.w)**2+Math.max(c.z-p.z,0,p.z-c.z-c.h)**2));
export function roomLightingEntrances(phi){
 const rooms=phi.floor.mergedRooms,portal=phi.circulation.lift?.portal;
 if(!rooms.length||!portal)return new Map();
 const start=point(portal);
 const root=rooms.map((room,i)=>({i,d:distanceToRoom(room,start)})).sort((a,b)=>a.d-b.d||a.i-b.i)[0].i;
 const entrances=new Map([[root,start]]),queue=[root];
 const links=phi.circulation.doors.map(d=>({a:d.a,b:d.b,pa:point(d),pb:point(d)}));
 for(const b of phi.bridges||[])links.push({a:b.fromRoom,b:b.toRoom,
  pa:point({axis:b.axis,at:b.from,centre:b.centre}),pb:point({axis:b.axis,at:b.to,centre:b.centre})});
 // Resolve equal-length routes by portal geometry, never construction order.
 links.sort((a,b)=>a.pa.x-b.pa.x||a.pa.z-b.pa.z||a.pb.x-b.pb.x||a.pb.z-b.pb.z);
 while(queue.length){
  const room=queue.shift();
  for(const link of links){
   const next=link.a===room?link.b:link.b===room?link.a:null;
   if(next===null||entrances.has(next))continue;
   entrances.set(next,link.a===next?link.pa:link.pb);queue.push(next);
  }
 }
 return entrances;
}
export function refineRoomLightEntries(entries,phi){
 const entrances=roomLightingEntrances(phi);
 return entries.map(entry=>{
  const roomIndex=phi.floor.mergedRooms.findIndex(r=>r.pieces.some(c=>
   c.x===entry.cell.x&&c.z===entry.cell.z&&c.w===entry.cell.w&&c.h===entry.cell.h));
  const room=phi.floor.mergedRooms[roomIndex];
  return {...entry,roomIndex,entrance:entrances.get(roomIndex),area:room?.pieces.reduce((sum,c)=>sum+c.w*c.h,0)||entry.cell.w*entry.cell.h};
 });
}
export function planRefinedPhiRoomLighting(entries,toWorld=(x,z)=>({x,z})){
 if(!entries.length)return [];
 const areas=entries.map(e=>e.area??e.cell.w*e.cell.h),min=Math.min(...areas),max=Math.max(...areas);
 // A near-uniform floor must not stretch tiny area differences into a full φ jump.
 const span=Math.max(max-min,max*.5,1e-8);
 const weights=areas.map(area=>1+(PHI-1)*(area-min)/span);
 const total=entries.reduce((sum,e)=>sum+e.power,0),scale=total/weights.reduce((sum,w)=>sum+w,0);
 return entries.map((entry,i)=>{
  const c=entry.cell,centre={x:c.x+c.w/2,z:c.z+c.h/2};
  // Ease towards the centre in narrow rooms: zero offset at 3m, full at 6m.
  const t=Math.max(0,Math.min(1,(Math.min(c.w,c.h)-3)/3));
  const offsetScale=t*t*(3-2*t);
  const offset=(1/PHI-.5)*offsetScale;
  const corners=[-1,1].flatMap(sx=>[-1,1].map(sz=>({x:centre.x+sx*c.w*offset,z:centre.z+sz*c.h*offset})));
  const distance=p=>entry.entrance?(p.x-entry.entrance.x)**2+(p.z-entry.entrance.z)**2:0;
  // Missing entrance => centred light, rather than an arbitrary corner.
  const selected=entry.entrance?corners.sort((a,b)=>distance(b)-distance(a)||a.x-b.x||a.z-b.z)[0]:centre;
  const p=toWorld(selected.x,selected.z);
  return {...p,power:weights[i]*scale,weight:weights[i],offsetScale,roomIndex:entry.roomIndex};
 });
}
