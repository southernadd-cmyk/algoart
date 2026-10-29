// Shared golden-ratio second pass, after allocation of rooms, walls and themes.
// Clearance and sightline rules are preserved for every move.
import {INV_PHI} from './phi-architecture.mjs';
const GOLDEN_SEPARATION=INV_PHI-.5;
const clamp01=x=>Math.max(0,Math.min(1,x));
// 0 at the wall centre, 1 at either feasible golden-section anchor.
export function wallPhiPreference(wall,u){
 if(!(wall.length>0))return 0;
 const a=wall.lo+wall.length*INV_PHI;
 const b=wall.hi-wall.length*INV_PHI;
 return clamp01(1-Math.min(Math.abs(u-a),Math.abs(u-b))/(wall.length*GOLDEN_SEPARATION));
}
function axisPhiPreference(fraction){
 return clamp01(1-Math.min(Math.abs(fraction-INV_PHI),
  Math.abs(fraction-(1-INV_PHI)))/GOLDEN_SEPARATION);
}
// Keep a smooth preference when one coordinate is constrained by a doorway.
export function sculpturePhiPreference(fx,fz){
 return (axisPhiPreference(fx)+axisPhiPreference(fz))/2;
}
export function classifyStudyMaterial(params={},saved='',explicit=''){
 const key=String(explicit||'').trim().toLowerCase();
 const base=String(saved||'').trim().toLowerCase();
 const canonical=value=>{
  if(/^oil(?:-v\d+)?$/.test(value))return 'oil';
  if(/^action(?:-v\d+)?$/.test(value))return 'action';
  if(/^(?:watercolour|watercolor)(?:-v[\da-z]+)?$/.test(value))return 'watercolour';
  if(/^tissue(?:-v\d+)?$/.test(value))return 'tissue';
  if(value==='marker')return 'marker';
  return '';
 };
 if(canonical(key))return canonical(key);
 if(params.tissue)return 'tissue';
 if(params.oil)return 'oil';
 if(params.watercolor||params.watercolour)return 'watercolour';
 return canonical(base)||base;
}

/**
 * Golden-ratio second pass. The existing curator chooses the rooms, walls,
 * study swaps and display dimensions. We move only the coordinates within
 * those fixed allocations, never re-hanging a work in another room.
 */
export function refinePhiExhibition(exhibition,floor,circulation,physical,phiAdherence=.65){
 phiAdherence=Number.isFinite(phiAdherence)?Math.max(0,Math.min(1,phiAdherence)):.65;
 if(phiAdherence<=0)return exhibition;
 const paintings=exhibition.paintings,sculptures=exhibition.sculptures;
 const surfaces=new Map(exhibition.surfaces.map(w=>[w.id,w]));
 const doors=[...circulation.doors,...(circulation.bridgePortals||[])];
 const pointInRoom=(room,x,z)=>room.pieces.some(p=>
  x>p.x+1e-4&&x<p.x+p.w-1e-4&&z>p.z+1e-4&&z<p.z+p.h-1e-4);
 const doorDistance=(x,z,d)=>Math.hypot(x-(d.axis==='x'?d.at:d.centre),z-(d.axis==='x'?d.centre:d.at));
 const paintingPosition=(w,u)=>w.axis==='x'?
  {x:w.at+w.normal.x*.20,z:u}:{x:u,z:w.at+w.normal.z*.20};
 const paintingFits=(p,w,u)=>{
  if(u-p.width/2<w.lo-1e-4||u+p.width/2>w.hi+1e-4)return false;
  const pos=paintingPosition(w,u);
  if(doors.some(d=>doorDistance(pos.x,pos.z,d)<.70))return false;
  if(!pointInRoom(floor.mergedRooms[p.room],
   pos.x+w.normal.x*2,pos.z+w.normal.z*2))return false;
  if(paintings.some(other=>other!==p&&other.surfaceId===p.surfaceId&&
    Math.abs(u-other.u)-(p.width+other.width)/2<.55-1e-6))return false;
  // A moved painting must never consume an existing sculpture sightline.
  if(sculptures.some(s=>s.room===p.room&&
   (p.axis==='x'?Math.abs(s.x-p.at):Math.abs(s.z-p.at))<2.35&&
   Math.abs((p.axis==='x'?s.z:s.x)-u)<p.width/2+.67))return false;
  return true;
 };
 // Keep the final expanded canvas dimensions; no cropping or resizing.
 for(const p of paintings){
  const w=surfaces.get(p.surfaceId);
  if(!w)continue;
  const phi=[w.lo+w.length*INV_PHI,w.hi-w.length*INV_PHI];
  let best=p.u,bestScore=wallPhiPreference(w,p.u);
  for(const target of phi)for(const step of [1,.8,.6,.4,.2,.1]){
   const u=p.u+(target-p.u)*phiAdherence*step;
   // Keep shifts compositional rather than re-hanging across an entire long wall.
   if(Math.abs(u-p.u)>1.5)continue;
   if(!paintingFits(p,w,u))continue;
   const affinity=wallPhiPreference(w,u);
   const score=affinity-Math.abs(u-p.u)*.04;
   if(score>bestScore+1e-5){best=u;bestScore=score;}
  }
  if(Math.abs(best-p.u)>1e-6){
   p.u=best;Object.assign(p,paintingPosition(w,best));
  }
 }
 const safeSculpture=(s,x,z)=>{
  const room=floor.mergedRooms[s.room];
  if(!room)return false;
  if(![[0,0],[1.15,0],[-1.15,0],[0,1.15],[0,-1.15]]
   .every(([dx,dz])=>pointInRoom(room,x+dx,z+dz)))return false;
  if(Math.hypot(x-circulation.lift.x,z-circulation.lift.z)<3.0)return false;
  if(doors.some(d=>doorDistance(x,z,d)<2.6))return false;
  if(physical.walls.some(w=>w.axis==='x'?
   Math.abs(x-w.at)<1.6&&z>w.lo-1.4&&z<w.hi+1.4:
   Math.abs(z-w.at)<1.6&&x>w.lo-1.4&&x<w.hi+1.4))return false;
  if((circulation.bridges||[]).some(b=>b.axis==='x'?
   x>b.from-1.8&&x<b.to+1.8&&Math.abs(z-b.centre)<b.width/2+1.3:
   z>b.from-1.8&&z<b.to+1.8&&Math.abs(x-b.centre)<b.width/2+1.3))return false;
  if(sculptures.some(other=>other!==s&&Math.hypot(x-other.x,z-other.z)<3.1))return false;
  if(paintings.some(p=>p.room===s.room&&
   (p.axis==='x'?Math.abs(z-p.u)<p.width/2+.65&&Math.abs(x-p.at)<2.35:
    Math.abs(x-p.u)<p.width/2+.65&&Math.abs(z-p.at)<2.35)))return false;
  return true;
 };
 const roomAffinity=(s,x,z)=>{
  const parts=floor.mergedRooms[s.room].pieces.filter(p=>
   x>=p.x&&x<=p.x+p.w&&z>=p.z&&z<=p.z+p.h);
  return parts.length?Math.max(...parts.map(p=>sculpturePhiPreference(
   (x-p.x)/p.w,(z-p.z)/p.h))):0;
 };
 for(const s of sculptures){
  let best={x:s.x,z:s.z},bestScore=roomAffinity(s,s.x,s.z);
  for(const piece of floor.mergedRooms[s.room].pieces){
   for(const fx of [INV_PHI,1-INV_PHI])for(const fz of [INV_PHI,1-INV_PHI]){
    const tx=piece.x+piece.w*fx,tz=piece.z+piece.h*fz;
    const dist=Math.hypot(tx-s.x,tz-s.z);
    if(dist<1e-6)continue;
    for(const step of [1,.75,.5,.25]){
     const factor=Math.min(phiAdherence*step,1.6/dist);
     const x=s.x+(tx-s.x)*factor,z=s.z+(tz-s.z)*factor;
     if(!safeSculpture(s,x,z))continue;
     const score=roomAffinity(s,x,z)-Math.hypot(x-s.x,z-s.z)*.06;
     if(score>bestScore+.02){best={x,z};bestScore=score;}
    }
   }
  }
  Object.assign(s,best);
 }
 exhibition.checks.inwardFacing=paintings.every(p=>pointInRoom(floor.mergedRooms[p.room],
  p.x+p.normal.x*.1,p.z+p.normal.z*.1));
 exhibition.checks.sculptureClearances=sculptures.every(s=>safeSculpture(s,s.x,s.z));
 return exhibition;
}
