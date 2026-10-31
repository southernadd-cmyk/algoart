// Artwork fit for compact golden-floor geometry. Pure planner; actual studies
// may replace the 18 deterministic preview records without changing identities.
import {INV_PHI} from './phi-architecture.mjs';
const GAP=.52,EDGE=.6;
export function planPhiArtwork(floor,circulation,physical,studies){
 const landscapes=studies.filter(s=>!s.portrait),portraits=studies.filter(s=>s.portrait);
 const zones=[];
 for(const w of physical.walls){
  // Do not hang art facing an internal edge belonging to the same gallery.
  if(w.hi-w.lo<1.4)continue;
  zones.push({...w,next:w.lo+EDGE,capacity:w.hi-w.lo-2*EDGE});
 }
 const paintings=[],sculptures=[],unplaced=[];
 // Pack evenly across galleries: prefer rooms with fewer works and longer walls.
 const counts=Array(floor.mergedRooms.length).fill(0);
 for(const study of landscapes){
  const width=Math.max(1.4,Math.min(2.4,Number(study.displayWidth)||2.15));
  const options=zones.filter(w=>w.hi-EDGE-w.next>=width).sort((a,b)=>
   (counts[a.room]-counts[b.room])*100+((b.hi-b.next)-(a.hi-a.next)));
  const w=options[0];
  if(!w){unplaced.push(study);continue;}
  const centre=w.next+width/2;w.next+=width+GAP;
  counts[w.room]++;
  paintings.push({studyId:study.id,room:w.room,width,height:width/(Number(study.aspect)||1.4),
    axis:w.axis,at:w.at,u:centre,x:w.axis==='x'?w.at:centre,z:w.axis==='x'?centre:w.at,orientation:w.axis==='x'?'east-west':'north-south'});
 }
 const clear=(x,z,room)=>{
  if(Math.hypot(x-circulation.lift.x,z-circulation.lift.z)<3.1)return false;
  if(!room.pieces.some(p=>x>p.x+1.65&&x<p.x+p.w-1.65&&z>p.z+1.65&&z<p.z+p.h-1.65))return false;
  if(physical.walls.some(w=>w.axis==='x'?Math.abs(x-w.at)<1.55&&z>w.lo-1.55&&z<w.hi+1.55:
   Math.abs(z-w.at)<1.55&&x>w.lo-1.55&&x<w.hi+1.55))return false;
  if(circulation.doors.some(d=>d.axis==='x'?Math.abs(x-d.at)<2.25&&Math.abs(z-d.centre)<2.25:
   Math.abs(z-d.at)<2.25&&Math.abs(x-d.centre)<2.25))return false;
  if((circulation.bridges||[]).some(b=>b.axis==='x'?x>b.from-2&&x<b.to+2&&Math.abs(z-b.centre)<2:
   z>b.from-2&&z<b.to+2&&Math.abs(x-b.centre)<2))return false;
  if(sculptures.some(s=>Math.hypot(s.x-x,s.z-z)<3.2))return false;
  return true;
 };
 for(const study of portraits){
  const rooms=[...floor.mergedRooms.keys()].sort((a,b)=>counts[a]-counts[b]||a-b);
  let found=null;
  for(const i of rooms){
   const room=floor.mergedRooms[i];
   for(const p of [...room.pieces].sort((a,b)=>b.w*b.h-a.w*a.h)){
    for(const fx of [INV_PHI,.5,1-INV_PHI])for(const fz of [INV_PHI,.5,1-INV_PHI]){
     const x=p.x+p.w*fx,z=p.z+p.h*fz;
     if(clear(x,z,room)){found={studyId:study.id,room:i,x,z,width:1.42,depth:1.32};break;}
    if(found)break;}if(found)break;
   }if(found)break;
  }
  if(found){sculptures.push(found);counts[found.room]++}else unplaced.push(study);
 }
 const ids=paintings.concat(sculptures).map(s=>s.studyId);
 return {paintings,sculptures,unplaced,checks:{complete:unplaced.length===0&&ids.length===studies.length,
 unique:new Set(ids).size===ids.length,landscapeCount:paintings.length===landscapes.length,portraitCount:sculptures.length===portraits.length},roomCounts:counts};
}
