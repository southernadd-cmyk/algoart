// Curatorial geometry adapter for the experimental phi gallery.
// Pure data, metres. Does not modify the live exhibition.
import {INV_PHI} from './phi-architecture.mjs';

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
 * Candidate scoring: strongly prefer long feature walls, good doorway
 * visibility, generous spacing and a mild golden-section offset.
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
