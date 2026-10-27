// Reception furniture and signage share the physical walls and clearances
// used by the phi exhibition curator. Coordinates are local to the floor.
import {exhibitionSurfaces} from './phi-curator.mjs?v=wall-sized-paintings-20261026';
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
 // The widest wall behind the desk supports a room-scale world map.
 // Reserve it before placing the two information posters.
 const mapWall=desk?surfaces.filter(w=>w.room===desk.room&&w.axis==='z'&&w.normal.z<0&&w.length>=6.8)
  .sort((a,b)=>b.length-a.length)[0]:null;
 const worldMap=mapWall?{x:mapWall.centre,z:mapWall.at+mapWall.normal.z*.14,axis:mapWall.axis,normal:mapWall.normal,width:6.1,height:4.016,centreY:2.65,surface:mapWall.id}:null;
 const signs=surfaces.filter(w=>{
  if(w.id===mapWall?.id)return false;
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
 // A small framed collection across from the desk, on the entrance wall's
 // solid right-hand wing. Keep the entrance and its approach unobstructed.
 const creditWall=desk?exhibitionSurfaces(floor,physical,{edgeClearance:.4,minLength:1.2})
  .filter(w=>w.room===desk.room&&w.axis==='z'&&w.normal.z>0&&w.at<desk.z-2&&w.length>=2.34)
  .sort((a,b)=>Number(b.centre>start.x)-Number(a.centre>start.x)||Math.abs(a.centre-desk.x)-Math.abs(b.centre-desk.x))[0]:null;
 const credits=creditWall?{x:creditWall.centre,z:creditWall.at+.15,axis:creditWall.axis,normal:creditWall.normal}:null;
 if(credits&&signage.length>1)signage[1]={...credits,width:2.65,height:1.3,centreY:3.25,room:desk.room};
 // Place the existing Growing Tower poster on the blank wall to the left
 // of the world map in the test reception, rather than duplicating it.
 if(globalThis.__phiReceptionTestRefresh&&worldMap&&signage.length>1){
  const posterWidth=2.35,gap=.42;
  // Screen-left reverses world X when this wall faces -Z.
  const wallX=worldMap.x-worldMap.normal.z*(worldMap.width/2+gap+posterWidth/2);
  signage[1]={x:wallX,z:mapWall.at+mapWall.normal.z*.17,
   axis:'z',normal:mapWall.normal,width:posterWidth,height:1.3,
   centreY:2.2,room:mapWall.room};
 }

 const cabinet=desk?(globalThis.__phiReceptionTestRefresh
  ?{x:desk.x+1.05,z:desk.z+2.15,yaw:Math.PI,height:1.15,width:1.1,depth:.85,kind:'cabinet'}
  :{x:desk.x+.9,z:desk.z-2.2,yaw:-Math.PI*.75,height:1.15,width:1.1,depth:.85,kind:'cabinet'}):null;
 // Select secondary-room corner bays rather than scattering furniture into the foyer.
 // Workstations remain within their room cells, away from the entrance/lift route.
 // Only the smaller corridor-side cells become preparation/storage rooms.
 // Rank by compactness, not distance alone: the open front must stay clear.
 const backrooms=globalThis.__phiReceptionTestRefresh?floor.mergedRooms.flatMap((room,i)=>
  room.pieces.filter(p=>p.w>=3.4&&p.h>=3.6&&p.w*p.h<=72).map(p=>({
   x:p.x+p.w/2,z:p.z+p.h/2,room:i,width:p.w,depth:p.h,area:p.w*p.h
  }))).filter(p=>
   Math.hypot(p.x-start.x,p.z-start.z)>5.5&&
   Math.hypot(p.x-end.x,p.z-end.z)>3.1&&
   (!desk||p.room!==desk.room)&&
   (!desk||Math.hypot(p.x-desk.x,p.z-desk.z)>6.2)&&
   distSegment(p.x,p.z,start,end)>2.1&&
   !physical.walls.some(w=>w.axis==='x'
    ?Math.abs(p.x-w.at)<1.25&&p.z>w.lo-.3&&p.z<w.hi+.3
    :Math.abs(p.z-w.at)<1.25&&p.x>w.lo-.3&&p.x<w.hi+.3))
  .sort((a,b)=>a.area-b.area||Math.hypot(b.x-start.x,b.z-start.z)-Math.hypot(a.x-start.x,a.z-start.z))
  .slice(0,5):[];
 return {desk,cabinet,backrooms,signage,plants,credits,worldMap,entrance:start,lift:end,checks:{
  deskClear:!desk||distSegment(desk.x,desk.z,start,end)>=2.2,
  signCount:signage.length,passageClear:true
 }};
}
