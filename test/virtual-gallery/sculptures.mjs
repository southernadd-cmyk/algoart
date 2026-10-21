// PROPORTION PIECE · sculpture placement and seeded construction.
// Coordinates in metres. No WebGL dependency, so these rules can be tested.
import {makeRandom,seedFromString,DOOR_WIDTH} from './layout-v2.mjs';

export const SCULPTURE_VERSION = 1;
export const ENGINE_FORMS = Object.freeze({
  field:'orbital',
  spiral:'ribbon',
  rects:'strata',
  burst:'radiant',
  network:'lattice',
  organic:'growth',
  geometric:'blocks',
  scribble:'gestural'
});
export const PEDESTAL_WIDTH=1.42;
export const PEDESTAL_DEPTH=1.32;
export const PEDESTAL_HEIGHT=.72;
export const SCULPTURE_HEIGHT=1.88;
export const SCULPTURE_WIDTH=1.34; // Approx. 1000:1400, matching archived portrait format

function seededStudy(study){
  return makeRandom(seedFromString('PP-SCULPTURE-v1:'+study.seed+':'+(study.engine||'field')));
}
export function planSculptureLayers(study,quality='desktop'){
  const rng=seededStudy(study);
  const count=quality==='mobile' ? 7 : quality==='vr' ? 8 : 11;
  const form=ENGINE_FORMS[study.engine] || 'orbital';
  const result=[];
  for(let i=0;i<count;i++){
    const t=i/Math.max(1,count-1),phase=t*Math.PI*2;
    let shiftX=0,shiftY=0,turn=0;
    switch(form){
      case 'strata': shiftX=(Math.floor(t*4)-1.5)*.067;shiftY=(i%2?1:-1)*.055;break;
      case 'ribbon': shiftX=Math.sin(phase*1.05)*.20;shiftY=Math.cos(phase*.85)*.085;turn=Math.sin(phase*.7)*.17;break;
      case 'lattice': shiftX=Math.sin(phase*1.8)*.12;shiftY=Math.cos(phase*2.2)*.11;turn=.075*Math.sin(phase*2);break;
      case 'growth': shiftX=(t-.5)*.24+Math.sin(phase*1.6)*.11;shiftY=t*.19-.10;turn=(t-.5)*.19;break;
      case 'blocks': shiftX=(Math.floor(t*3)-1)*.12;shiftY=(i%3-1)*.052;turn=(i%2?1:-1)*.055;break;
      case 'gestural': shiftX=(rng()-.5)*.35;shiftY=(rng()-.5)*.23;turn=(rng()-.5)*.24;break;
      case 'radiant': shiftX=Math.sin(phase)*t*.21;shiftY=Math.cos(phase)*t*.15;turn=(t-.5)*.25;break;
      default: shiftX=Math.cos(phase)*.16;shiftY=Math.sin(phase)*.12;turn=(t-.5)*.12;
    }
    result.push({
      index:i,count,form,
      shiftX,shiftY,turn,
      depth:(t-.5)*(.50+(form==='lattice'?.16:0)),
      alpha:.65 + (i%3)*.08,
      maskSeed:Math.floor(rng()*0xffffffff)>>>0,
      isBacking:i===0
    });
  }
  return result;
}
export function planGallerySculptures(layout,studies){
  const result=[];
  for(const room of layout.rooms){
    const portraits=studies.slice(room.artStart,room.artEnd).filter(study=>study.portrait);
    const rng=makeRandom(seedFromString('PP-PLINTH-LOCATIONS-v1:'+layout.date+':'+room.index+':'+portraits.map(p=>p.seed).join('|')));
    const x=room.width/2-1.11,z=room.depth/2-1.07;
    // Offset corners leave the 3.8 m doorway sightline free in *both*
    // directions. The first positions vary between exhibitions.
    const corners=[[-x,-z],[x,z],[-x,z],[x,-z]];
    const rotation=Math.floor(rng()*corners.length);
    const options=corners.slice(rotation).concat(corners.slice(0,rotation));
    for(let i=0;i<portraits.length;i++){
      const study=portraits[i];
      const [ox,oz]=options[i];
      // The front of each layered sculpture faces the accessible room centre.
      const yaw=Math.atan2(-ox,-oz);
      result.push({
        studyId:study.id,roomIndex:room.index,
        x:room.x+ox,z:room.z+oz,y:room.y,
        yaw,form:ENGINE_FORMS[study.engine]||'orbital',
        width:PEDESTAL_WIDTH,depth:PEDESTAL_DEPTH,
        engine:study.engine,seed:study.seed
      });
    }
  }
  if(result.length!==studies.filter(s=>s.portrait).length||
    new Set(result.map(p=>p.studyId)).size!==result.length)
    throw new Error('Each portrait must have one sculpture');
  return result;
}
export function clearOfSculptures(sculptures,x,z,padding=.45){
  return sculptures.every(s=>Math.abs(x-s.x)>=s.width/2+padding ||
    Math.abs(z-s.z)>=s.depth/2+padding);
}
export function validateSculpturePlacement(layout,sculptures){
  for(const sculpture of sculptures){
    const room=layout.rooms[sculpture.roomIndex];
    if(!room)throw new Error('Sculpture outside a room');
    if(Math.abs(sculpture.x-room.x)+sculpture.width/2>room.width/2-.27||
       Math.abs(sculpture.z-room.z)+sculpture.depth/2>room.depth/2-.27)
      throw new Error('Sculpture intersects a gallery wall');
    // The centre aisle must remain clear even where doors are on all four sides.
    const safe=DOOR_WIDTH/2+.22;
    if(Math.abs(sculpture.x-room.x)-sculpture.width/2<safe ||
       Math.abs(sculpture.z-room.z)-sculpture.depth/2<safe)
      throw new Error('Sculpture blocks a connecting route');
    for(const other of sculptures){
      if(other===sculpture||other.roomIndex!==sculpture.roomIndex)continue;
      if(Math.abs(sculpture.x-other.x)<sculpture.width/2+other.width/2+.35 &&
         Math.abs(sculpture.z-other.z)<sculpture.depth/2+other.depth/2+.35)
        throw new Error('Sculpture plinths collide');
    }
  }
  return true;
}
