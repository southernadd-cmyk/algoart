// Shared live/test curator: safe geometry followed by thematic assignment.
import {INV_PHI} from './phi-architecture.mjs';
import {groupPhiExhibition} from './phi-curation-groups.mjs';
import {refinePhiExhibition} from './phi-curation-refinement.mjs';
import {preExpandPhiPaintings} from './phi-pre-expansion.mjs';

const EPS=1e-4;
const pointInRoom=(room,x,z)=>room.pieces.some(p=>x>p.x+EPS&&x<p.x+p.w-EPS&&z>p.z+EPS&&z<p.z+p.h-EPS);
const nudge=(w,side,d)=>w.axis==='x'?{x:w.at+side*d,z:(w.lo+w.hi)/2}:{x:(w.lo+w.hi)/2,z:w.at+side*d};

/**
 * Convert rendered physical wall sections into exhibition surfaces.
 * Each candidate faces into exactly one merged room. Excludes external
 * ambiguity, two-sided shared boundaries, thin returns and apertures.
 */
export function exhibitionSurfaces(floor,physical,{edgeClearance=.55,minLength=1.6}={}){
  const result=[];
  for(const [i,w] of physical.walls.entries()){
    const length=w.hi-w.lo;
    if(length<minLength+2*edgeClearance)continue;
    const plus=nudge(w,1,.12),minus=nudge(w,-1,.12);
    const plusRoom=floor.mergedRooms.findIndex(r=>pointInRoom(r,plus.x,plus.z));
    const minusRoom=floor.mergedRooms.findIndex(r=>pointInRoom(r,minus.x,minus.z));
    // A shared wall is not safe until both surfaces are modelled explicitly.
    if((plusRoom>=0)===(minusRoom>=0))continue;
    const side=plusRoom>=0?1:-1,room=plusRoom>=0?plusRoom:minusRoom;
    if(room!==w.room)continue;
    const normal=w.axis==='x'?{x:side,z:0}:{x:0,z:side};
    result.push({id:'surface-'+i,room,axis:w.axis,at:w.at,lo:w.lo+edgeClearance,
      hi:w.hi-edgeClearance,normal,length:length-2*edgeClearance,
      centre:(w.lo+w.hi)/2});
  }
  return result;
}
function distanceToDoor(p,door){
  const x=door.axis==='x'?door.at:door.centre,z=door.axis==='x'?door.centre:door.at;
  return Math.hypot(p.x-x,p.z-z);
}
function worldPosition(w,u,inset=.20){
 return w.axis==='x'?{x:w.at+w.normal.x*inset,z:u}:{x:u,z:w.at+w.normal.z*inset};
}
function widthFor(study){
 const aspect=Number(study.aspect)||(study.portrait?1/1.4:1.4);
 return Math.min(2.45,Math.max(1.3,Number(study.displayWidth)||2.15),3.0*aspect);
}
/**
 * Candidate scoring: favour long feature walls, doorway visibility,
 * spacing and central hang positions. Golden-section offsets are applied
 * separately after wall and room allocation (before/after expansion on test).
 * Existing room assignment is deliberately not assumed.
 */
export function planCuratedPhiArtwork(floor,circulation,physical,studies){
 const surfaces=exhibitionSurfaces(floor,physical);
 const wallPlacements=[],unplaced=[],occupied=new Map();
 const landscapes=studies.filter(s=>!s.portrait);
 const roomCounts=new Array(floor.mergedRooms.length).fill(0);
 const doors=[...circulation.doors,...(circulation.bridgePortals||[])];
 const ordered=[...landscapes].sort((a,b)=>widthFor(b)-widthFor(a)||String(a.id).localeCompare(String(b.id)));
 for(const study of ordered){
   const width=widthFor(study),aspect=Number(study.aspect)||1.4;
   let best=null;
   for(const wall of surfaces){
     const centres=[wall.centre,wall.lo+wall.length*INV_PHI,wall.hi-wall.length*INV_PHI,
       wall.lo+width/2,wall.hi-width/2];
     for(const u of centres){
       if(u-width/2<wall.lo-EPS||u+width/2>wall.hi+EPS)continue;
       const peers=occupied.get(wall.id)||[];
       const minGap=peers.reduce((m,p)=>Math.min(m,Math.abs(u-p.u)-(width+p.width)/2),Infinity);
       if(minGap<.42)continue;
       const pos=worldPosition(wall,u);
       // Centre-to-door clearance prevents artwork on portal returns.
       if(doors.some(d=>distanceToDoor(pos,d)<.70))continue;
       const viewing={x:pos.x+wall.normal.x*2,z:pos.z+wall.normal.z*2};
       if(!pointInRoom(floor.mergedRooms[wall.room],viewing.x,viewing.z))continue;
       const distinctWalls=wallPlacements.filter(p=>p.room===wall.room&&p.surfaceId===wall.id).length;
       const score=wall.length*.22-roomCounts[wall.room]*2.8-distinctWalls*.7+
          Math.min(2,minGap===Infinity?2:minGap)*.2-
          Math.abs(u-wall.centre)*.04;
       if(!best||score>best.score)best={wall,u,pos,score};
     }
   }
   if(!best){unplaced.push(study);continue;}
   const {wall,u,pos}=best;
   const item={studyId:study.id,room:wall.room,surfaceId:wall.id,
     axis:wall.axis,at:wall.at,u,x:pos.x,z:pos.z,
     normal:wall.normal,width,height:width/aspect,
     y:1.52,orientation:wall.axis==='x'?'east-west':'north-south'};
   wallPlacements.push(item);
   (occupied.get(wall.id)||occupied.set(wall.id,[]).get(wall.id)).push(item);
   roomCounts[wall.room]++;
 }
 const ids=wallPlacements.map(p=>p.studyId);
 return {paintings:wallPlacements,unplaced,surfaces,roomCounts,
   checks:{unique:new Set(ids).size===ids.length,
     paintingsComplete:wallPlacements.length===landscapes.length,
     inwardFacing:wallPlacements.every(p=>pointInRoom(floor.mergedRooms[p.room],
       p.x+p.normal.x*.1,p.z+p.normal.z*.1))}};
}

/** Grow each completed hang into unused wall space, after reserving sculpture
 * viewing corridors. Keep every artwork and its safe doorway position. */
export function expandPhiPaintings(hang,sculptures){
 const originals=hang.paintings.map(p=>({...p})),targets=[];
 for(const p of originals){
  const wall=hang.surfaces.find(w=>w.id===p.surfaceId),aspect=p.width/p.height;
  let width=Math.min(4.8,3.3*aspect,2*(p.u-wall.lo),2*(wall.hi-p.u));
  for(const other of originals){
   if(other===p||other.surfaceId!==p.surfaceId)continue;
   const gap=Math.abs(p.u-other.u)-(p.width+other.width)/2;
   width=Math.min(width,p.width+Math.max(0,gap-.55));
  }
  for(const sculpture of sculptures){
   if(sculpture.room!==p.room)continue;
   const normalDistance=p.axis==='x'?Math.abs(sculpture.x-p.at):Math.abs(sculpture.z-p.at);
   if(normalDistance>=2.35)continue;
   const along=p.axis==='x'?sculpture.z:sculpture.x;
   width=Math.min(width,2*(Math.abs(along-p.u)-.67));
  }
  width=Math.max(p.width,width);const height=width/aspect;
  targets.push({width,height,y:Math.max(1.72,height/2+.62)});
 }
 hang.paintings.forEach((p,i)=>Object.assign(p,targets[i]));
 return hang;
}

/** Curate portrait sculptures after the wall hang, reserving visitor sightlines. */
export function planCuratedPhiExhibition(floor,circulation,physical,studies,{phiAdherence=.65}={}){
 const hang=planCuratedPhiArtwork(floor,circulation,physical,studies);
 const sculptures=[],rejected=[];
 const doors=[...circulation.doors,...(circulation.bridgePortals||[])];
 const lift=circulation.lift;
 const roomCounts=[...hang.roomCounts];
 function safe(room,x,z){
  const radius=1.15;
  // Clearance must work on all four sides of each installation.
  if(![[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([dx,dz])=>pointInRoom(room,x+dx,z+dz)))return false;
  if(Math.hypot(x-lift.x,z-lift.z)<3.0)return false;
  if(doors.some(d=>distanceToDoor({x,z},d)<2.6))return false;
  if(physical.walls.some(w=>w.axis==='x'?
    Math.abs(x-w.at)<1.6&&z>w.lo-1.4&&z<w.hi+1.4:
    Math.abs(z-w.at)<1.6&&x>w.lo-1.4&&x<w.hi+1.4))return false;
  if((circulation.bridges||[]).some(b=>b.axis==='x'?
    x>b.from-1.8&&x<b.to+1.8&&Math.abs(z-b.centre)<b.width/2+1.3:
    z>b.from-1.8&&z<b.to+1.8&&Math.abs(x-b.centre)<b.width/2+1.3))return false;
  if(sculptures.some(p=>Math.hypot(x-p.x,z-p.z)<3.1))return false;
  // Leave a 2 m observation corridor in front of displayed paintings.
  if(hang.paintings.some(p=>p.room===room.index&&
     (p.axis==='x'?Math.abs(z-p.u)<p.width/2+.65&&Math.abs(x-p.at)<2.35:
      Math.abs(x-p.u)<p.width/2+.65&&Math.abs(z-p.at)<2.35)))return false;
  return true;
 }
 // Test fixed architectural clearances once per floor, before occupancy.
 // The denser lattice retains all original golden-section anchor positions.
 const fractions=size=>[...new Set([INV_PHI,1-INV_PHI,.5,
   ...Array.from({length:Math.max(0,Math.floor((size-3.2)/.7)+1)},(_,n)=>(1.6+n*.7)/size)])];
 const candidates=[];
 for(let i=0;i<floor.mergedRooms.length;i++){
  const room=floor.mergedRooms[i];
  for(const p of room.pieces)for(const fx of fractions(p.w))for(const fz of fractions(p.h)){
   const x=p.x+p.w*fx,z=p.z+p.h*fz;
   if(!safe({...room,index:i},x,z))continue;
   const clearance=Math.min(x-p.x,p.x+p.w-x,z-p.z,p.z+p.h-z);
   candidates.push({room:i,x,z,score:clearance*.35+Math.min(3,Math.hypot(x-lift.x,z-lift.z))*.1});
  }
 }
 for(const study of studies.filter(s=>s.portrait)){
  let best=null;
  for(const candidate of candidates){
   const {room,x,z}=candidate;
   if(sculptures.some(p=>Math.hypot(x-p.x,z-p.z)<3.1))continue;
   const score=candidate.score-roomCounts[room]*2.2;
   if(!best||score>best.score)best={studyId:study.id,room,x,z,width:1.42,depth:1.32,score};
  }
  if(best){const {score,...placed}=best;sculptures.push(placed);roomCounts[best.room]++;}
  else rejected.push(study);
 }
 // Preserve all wall allocations; position the paintings towards φ first.
 preExpandPhiPaintings(hang,sculptures,floor,circulation,physical,phiAdherence,expandPhiPaintings);
 expandPhiPaintings(hang,sculptures);
 const curation=groupPhiExhibition(hang.paintings,sculptures,studies);
 const unplaced=[...hang.unplaced,...rejected];
 const ids=[...hang.paintings,...sculptures].map(a=>a.studyId);
 const exhibition={...hang,sculptures,unplaced,roomCounts,curation,checks:{...hang.checks,
   unique:new Set(ids).size===ids.length,
   complete:unplaced.length===0&&ids.length===studies.length,
   sculptureCount:sculptures.length,
   sculptureClearances:sculptures.every(s=>safeWithoutSelf(s))}};
 return refinePhiExhibition(exhibition,floor,circulation,physical,phiAdherence);
 function safeWithoutSelf(s){
  const at=sculptures.indexOf(s);sculptures.splice(at,1);
  const ok=safe({...floor.mergedRooms[s.room],index:s.room},s.x,s.z);
  sculptures.splice(at,0,s);
  return ok;
 }
}

