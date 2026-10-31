// Phase B study: connected doors and fixed lift anchor for merged phi cells.
import {INV_PHI} from './phi-architecture.mjs';
const EPS=1e-6,DOOR=2.4;
const overlapping=(a,b,c,d)=>[Math.max(a,c),Math.min(b,d)];
export function planPhiCirculation(plan){
 const rooms=plan.mergedRooms;
 const belong=new Map(rooms.flatMap((r,i)=>r.cells.map(id=>[id,i])));
 const shared=[];
 for(let i=0;i<plan.rooms.length;i++)for(let j=i+1;j<plan.rooms.length;j++){
  const a=plan.rooms[i],b=plan.rooms[j],ra=belong.get(a.id),rb=belong.get(b.id);
  if(ra===rb)continue;
  const [z0,z1]=overlapping(a.z,a.z+a.h,b.z,b.z+b.h);
  const [x0,x1]=overlapping(a.x,a.x+a.w,b.x,b.x+b.w);
  if(z1-z0>=DOOR+1&&Math.abs(a.x+a.w-b.x)<EPS)shared.push({a:ra,b:rb,axis:'x',at:b.x,lo:z0,hi:z1});
  else if(z1-z0>=DOOR+1&&Math.abs(b.x+b.w-a.x)<EPS)shared.push({a:ra,b:rb,axis:'x',at:a.x,lo:z0,hi:z1});
  else if(x1-x0>=DOOR+1&&Math.abs(a.z+a.h-b.z)<EPS)shared.push({a:ra,b:rb,axis:'z',at:b.z,lo:x0,hi:x1});
  else if(x1-x0>=DOOR+1&&Math.abs(b.z+b.h-a.z)<EPS)shared.push({a:ra,b:rb,axis:'z',at:a.z,lo:x0,hi:x1});
 }
 // Lift datum is permanent across all dates: locate the room at this fixed point.
 const anchor={x:plan.root.x+2.2,z:plan.root.z+2.2};
 let liftRoom=rooms.findIndex(r=>r.pieces.some(p=>anchor.x>=p.x-EPS&&anchor.x<=p.x+p.w+EPS&&anchor.z>=p.z-EPS&&anchor.z<=p.z+p.h+EPS));
 if(liftRoom<0)liftRoom=0;
 const visited=new Set([liftRoom]),doors=[];
 // Max shared boundary preference yields broad, practical connection points.
 while(visited.size<rooms.length){
  const next=shared.filter(s=>visited.has(s.a)!==visited.has(s.b))
   .sort((a,b)=>(b.hi-b.lo)-(a.hi-a.lo))[0];
  if(!next)break;
  const width=Math.min(DOOR,next.hi-next.lo-.5);
  const middle=next.lo+(next.hi-next.lo)*INV_PHI;
  const centre=Math.max(next.lo+width/2+.25,Math.min(next.hi-width/2-.25,middle));
  doors.push({...next,centre,width,from:rooms[next.a].id,to:rooms[next.b].id});
  visited.add(next.a);visited.add(next.b);
 }
 const connected=visited.size===rooms.length;
 // Walls longer than 3 metres are candidates for landscape hangings.
 const wallSegments=[];
 for(const c of plan.rooms){
  const owner=belong.get(c.id);
  const edges=[{axis:'x',at:c.x,lo:c.z,hi:c.z+c.h},{axis:'x',at:c.x+c.w,lo:c.z,hi:c.z+c.h},{axis:'z',at:c.z,lo:c.x,hi:c.x+c.w},{axis:'z',at:c.z+c.h,lo:c.x,hi:c.x+c.w}];
  for(const edge of edges){
   // Retain partial exterior boundaries after accounting for adjacent same-room cells.
   let spans=[[edge.lo,edge.hi]];
   for(const other of plan.rooms){
    if(other.id===c.id||belong.get(other.id)!==owner)continue;
    const aligned=edge.axis==='x'?(Math.abs(other.x-edge.at)<EPS||Math.abs(other.x+other.w-edge.at)<EPS):(Math.abs(other.z-edge.at)<EPS||Math.abs(other.z+other.h-edge.at)<EPS);
    if(!aligned)continue;
    const low=edge.axis==='x'?other.z:other.x,high=edge.axis==='x'?other.z+other.h:other.x+other.w;
    spans=spans.flatMap(([l,h])=>{const a=Math.max(l,low),b=Math.min(h,high);return a>=b?[[l,h]]:[[l,a],[b,h]].filter(p=>p[1]-p[0]>EPS);});
   }
   for(const [lo,hi] of spans)if(hi-lo>=3)wallSegments.push({room:owner,axis:edge.axis,at:edge.at,lo,hi});
  }
 }
 return {lift:{...anchor,room:liftRoom},doors,sharedBoundaries:shared.length,connected,reachable:visited.size,roomCount:rooms.length,wallSegments,
  checks:{connected,doorWidth:doors.every(d=>d.width>=1.9),hasHangingWalls:rooms.every((r,i)=>wallSegments.some(w=>w.room===i))}};
}
