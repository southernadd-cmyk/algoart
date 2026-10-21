// Display curator for graph-based architectural layouts.
// Keep a clear doorway around every portal. No painting is replicated.
import { makeRandom, seedFromString, DOOR_WIDTH, ROOM_HEIGHT } from './layout-v2.mjs';
const PROFILES=['paired','focal','end-wall','salon','asymmetric','quiet'];
const SIZES={
  landscape:{hero:3.56,medium:2.62,small:1.72},
  portrait:{hero:2.20,medium:1.76,small:1.29}
};
const SIDES=['north','east','south','west'];
function artRatio(study) {
  return Math.max(.5,Math.min(2.4,Number(study.aspect)||(study.portrait?1/1.4:1.4)));
}
function walls(room){
  const result=[];
  for(const surface of SIDES){
    const length=(surface==='north'||surface==='south')?room.width:room.depth;
    const outer=length/2-.48;
    if(!room.doors.includes(surface))result.push({surface,lo:-outer,hi:outer,closed:true});
    else{
      result.push({surface,lo:-outer,hi:-DOOR_WIDTH/2-.26,closed:false});
      result.push({surface,lo:DOOR_WIDTH/2+.26,hi:outer,closed:false});
    }
  }
  return result.filter(s=>s.hi-s.lo>1.22);
}
function onWall(room,surface,u){
  switch(surface){
    case 'north':return{x:room.x+u,z:room.z-room.depth/2+.245};
    case 'south':return{x:room.x+u,z:room.z+room.depth/2-.245};
    case 'east':return{x:room.x+room.width/2-.245,z:room.z+u};
    default:return{x:room.x-room.width/2+.245,z:room.z+u};
  }
}
export function planRoomHangs(room,studies,date){
  if(!studies.length)return[];
  const rng=makeRandom(seedFromString('PP-ART-CURATION-v2:'+date+':'+room.index+':'+studies.map(s=>s.seed).join('|')));
  const profile=PROFILES[room.index%PROFILES.length];
  const zones=walls(room);
  const closed=zones.filter(s=>s.closed);
  const open=zones.filter(s=>!s.closed);
  // A room with many exits has fewer continuous walls. Prioritise complete
  // walls for hero pieces and use portal wings for the remaining small works.
  const shift=Math.floor(rng()*Math.max(1,closed.length));
  const preferred=[...closed.slice(shift),...closed.slice(0,shift),...open];
  const result=[];
  const remaining=[...studies];
  function put(study,role,surface=null,target=null){
    if(!study)return false;
    const allowed=surface ? [...preferred.filter(z=>z.surface===surface),...preferred.filter(z=>z.surface!==surface)] : preferred;
    let ideal=SIZES[study.portrait?'portrait':'landscape'][role];
    const ratio=artRatio(study);
    // Cap large portraits by ceiling height, while preserving source aspect.
    ideal=Math.min(ideal, (ROOM_HEIGHT-1.6)*ratio);
    for(const segment of allowed){
      const margin=.055;
      const maxWidth=segment.hi-segment.lo-2*margin;
      if(maxWidth<1.13)continue;
      const width=Math.min(ideal,maxWidth);
      const lo=segment.lo+width/2+margin,hi=segment.hi-width/2-margin;
      if(hi<lo-.001)continue;
      const centre=(segment.lo+segment.hi)/2;
      const candidates=[target==null?centre:target,centre,lo,hi,
        lo+(hi-lo)*.25,lo+(hi-lo)*.75];
      let u=null;
      for(const candidate of candidates){
        if(candidate<lo-.001||candidate>hi+.001)continue;
        const overlapping=result.some(p=>p.surface===segment.surface &&
          Math.abs(p.u-candidate)<(p.width+width)/2+.31);
        if(!overlapping){u=candidate;break;}
      }
      if(u===null)continue;
      const height=width/ratio;
      const floorCentre=Math.max(2.40,Math.min(2.7,1.25+height/2));
      const at=onWall(room,segment.surface,u);
      result.push({
        roomIndex:room.index,studyId:study.id,surface:segment.surface,
        role:Math.abs(width-ideal)>.10?'small':role,profile,
        width,height,u,x:at.x,z:at.z,y:room.y+floorCentre
      });
      remaining.splice(remaining.indexOf(study),1);
      return true;
    }
    return false;
  }
  const hero=remaining.find(s=>!s.portrait)||remaining[0];
  const prime=closed[0]?.surface || preferred[0]?.surface;
  const secondary=closed[1]?.surface || open[0]?.surface || prime;
  if(profile==='paired' && closed.length && studies.length>=2){
    const pair=remaining.filter(s=>!s.portrait);
    if(pair.length>=2){
      const length=(prime==='north'||prime==='south')?room.width:room.depth;
      put(pair[0],'medium',prime,-length*.23);
      put(pair[1],'medium',prime,length*.23);
    }else{
      put(hero,'hero',prime,0);
    }
  }else if(profile==='salon'&&closed.length&&studies.length>=3) {
    const length=(prime==='north'||prime==='south')?room.width:room.depth;
    put(remaining[0],'small',prime,-length*.31);
    put(remaining[0],'medium',prime,0);
    put(remaining[0],'small',prime,length*.31);
  }else if(profile==='asymmetric'&&closed.length){
    const length=(prime==='north'||prime==='south')?room.width:room.depth;
    put(hero,'hero',prime,-length*.13);
  }else if(profile==='quiet'&&closed.length){
    put(hero,'hero',prime,0);
  }else{
    put(hero,'hero',prime,0);
  }
  if(remaining.length)put(remaining[0],profile==='quiet'?'small':'medium',secondary,null);
  if(remaining.length)put(remaining[0],profile==='paired'?'hero':'small',null,null);
  while(remaining.length){
    const study=remaining[0];
    if(!put(study,'small',null,null))throw new Error('Room '+room.index+' has no safe wall space for '+study.seed);
  }
  return result;
}
export function planGalleryHangs(layout,studies){
  const placements=layout.rooms.flatMap(room=>planRoomHangs(room,studies.slice(room.artStart,room.artEnd),layout.date));
  const ids=new Set(placements.map(p=>p.studyId));
  if(placements.length!==studies.length||ids.size!==studies.length)throw new Error('Every study must hang exactly once');
  return placements;
}
