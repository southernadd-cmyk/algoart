// Reception furniture and signage share the physical walls and clearances
// used by the phi exhibition curator. Coordinates are local to the floor.
import {exhibitionSurfaces} from './phi-curator.mjs';
const distSegment=(x,z,a,b)=>{
 const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
 return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
};
export function planPhiReception(floor,circulation,physical){
 const entrance=circulation.publicEntrance;
 if(!entrance)throw new Error('Reception needs a public doorway');
 const start=entrance.axis==='z'?{x:entrance.centre,z:entrance.at}:{x:entrance.at,z:entrance.centre};
 const end={x:circulation.lift.portal.at,z:circulation.lift.portal.centre};
 const surfaces=exhibitionSurfaces(floor,physical,{edgeClearance:.7,minLength:3.4});
 const entries=[];
 for(const p of floor.mergedRooms.flatMap((room,i)=>room.pieces.map(cell=>({...cell,room:i})))){
  if(p.w<4.1||p.h<4.1)continue;
  for(const fx of [.3,.5,.7])for(const fz of [.3,.5,.7]){
   const x=p.x+p.w*fx,z=p.z+p.h*fz;
   const wallGap=Math.min(x-p.x,p.x+p.w-x,z-p.z,p.z+p.h-z);
   if(wallGap<1.25||Math.hypot(x-start.x,z-start.z)<3.1||Math.hypot(x-end.x,z-end.z)<3.0)continue;
   if(distSegment(x,z,start,end)<2.2)continue;
   if(physical.walls.some(w=>w.axis==='x'?Math.abs(x-w.at)<1.3&&z>w.lo-1.2&&z<w.hi+1.2:Math.abs(z-w.at)<1.3&&x>w.lo-1.2&&x<w.hi+1.2))continue;
   entries.push({x,z,room:p.room,score:wallGap+distSegment(x,z,start,end)*.16});
  }
 }
 entries.sort((a,b)=>b.score-a.score);
 const desk=entries[0]||null;
 const signs=surfaces.filter(w=>{
  const x=w.axis==='x'?w.at+w.normal.x*.25:w.centre;
  const z=w.axis==='z'?w.at+w.normal.z*.25:w.centre;
  return Math.hypot(x-start.x,z-start.z)>2.0&&Math.hypot(x-end.x,z-end.z)>2.1&&
   (!desk||Math.hypot(x-desk.x,z-desk.z)>1.7);
 }).sort((a,b)=>b.length-a.length);
 const signage=signs.slice(0,2).map(w=>({
   x:w.axis==='x'?w.at+w.normal.x*.14:w.centre,
   z:w.axis==='z'?w.at+w.normal.z*.14:w.centre,
   axis:w.axis,normal:w.normal,width:Math.min(4.4,w.length-.1),room:w.room
 }));
 const corners=floor.mergedRooms.flatMap((room,i)=>room.pieces.flatMap(p=>[
  {x:p.x+.75,z:p.z+.75,room:i},{x:p.x+p.w-.75,z:p.z+.75,room:i},
  {x:p.x+.75,z:p.z+p.h-.75,room:i},{x:p.x+p.w-.75,z:p.z+p.h-.75,room:i}
 ]));
 const plants=corners.filter(p=>Math.hypot(p.x-start.x,p.z-start.z)>3.4&&
  Math.hypot(p.x-end.x,p.z-end.z)>2.8&&distSegment(p.x,p.z,start,end)>2.3&&
  (!desk||Math.hypot(p.x-desk.x,p.z-desk.z)>2))
  .slice(0,2).map(p=>({...p,placement:'corner'}));
 return {desk,signage,plants,entrance:start,lift:end,checks:{
  deskClear:!desk||distSegment(desk.x,desk.z,start,end)>=2.2,
  signCount:signage.length,passageClear:true
 }};
}
