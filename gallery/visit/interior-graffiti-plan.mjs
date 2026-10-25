// Small handstyle signatures on wall faces left entirely clear by the curator.
import {makeRandom} from '../../test/graffiti/tag-engine.mjs?v=sprayed-throwups-v7';
import {makeTowerFamilyTag,TOWER_LETTERING_REVISION} from './tower-family-lettering.mjs';
import {DOOR_WIDTH} from './layout-v2.mjs';
import {fitPhiTag} from './graffiti-placement.mjs';
import {towerHandCycle,towerTagSlot} from './tower-graffiti-styles.mjs';
import {GRAFFITI_WORDS} from './exterior-graffiti-plan.mjs';
const SIDES=['north','south','east','west'];
const outward={north:{x:0,z:-1},south:{x:0,z:1},east:{x:1,z:0},west:{x:-1,z:0}};
const INKS=['#242a28','#4c2630','#293849','#3e4938'];
export function interiorWallFaces(layout,hangs){
 const painted=new Set(hangs.map(h=>h.roomIndex+':'+h.surface)),faces=[];
 for(const room of layout.rooms)for(const side of SIDES){
  const id=room.index+':'+side;if(painted.has(id))continue;
  const out=outward[side],normal={x:-out.x,z:-out.z},horizontal=!out.x,length=horizontal?room.width:room.depth;
  const fixed=horizontal?room.z+out.z*room.depth/2:room.x+out.x*room.width/2;
  const opening=side===room.liftWall?1.85:side===room.entranceWall?3.4:room.doors.includes(side)?DOOR_WIDTH:0;
  const outer=length/2-.5,segments=opening?[[-outer,-opening/2-.42],[opening/2+.42,outer]]:[[-outer,outer]];
  for(const [index,[lo,hi]] of segments.entries())if(hi-lo>.42)faces.push({id,segmentId:id+':'+index,roomIndex:room.index,side,normal,length,fixed,roomY:room.y,
   centre:{x:horizontal?room.x:fixed,z:horizontal?fixed:room.z},lo,hi,opening});
 }
 return faces;
}
export function interiorGraffitiKey({layout,hangs,level}){
 return TOWER_LETTERING_REVISION+'|'+level+':'+layout.date+':'+layout.rooms.map(r=>[r.x,r.z,r.width,r.depth,r.y,r.liftWall||'',r.entranceWall||'',r.doors.join(',')].join(',')).join(';')+':'+hangs.map(h=>h.roomIndex+':'+h.surface).sort().join('|');
}
export function planInteriorGraffiti({layout,hangs,level},{seed='PP-INDOOR-WRITING-01',floorSpacing=6.2}={}){
 const r=makeRandom(seed+'|'+layout.date),count=r.int(3,5),phase=r.int(0,31),faces=interiorWallFaces(layout,hangs),marks=[],usedRooms=new Set(),usedFaces=new Set(),styles=towerHandCycle(seed+'|'+layout.date+'|indoor');
 if(!faces.length)throw new Error('No painting-free interior wall on '+layout.date);
 for(let slot=0;slot<count;slot++){
  const hand=styles[slot];
  const item=towerTagSlot({floorId:layout.date,seed:seed+'|slot|'+slot,slot,hand});
  const phrase=GRAFFITI_WORDS[(phase+slot)%GRAFFITI_WORDS.length],ink=r.pick(INKS),tag=makeTowerFamilyTag(phrase,{...item,ink,paintWidth:1.6});
  const desiredWidth=phrase==='Proportion Piece'?r.range(1.05,1.35):phrase==='PHI'?r.range(.55,.85):r.range(.25,.4);
  const candidates=faces.map(face=>{
   const placement=fitPhiTag({bounds:tag.bounds,desiredWidth,maxHeight:.45,lo:face.lo,hi:face.hi,bottom:.65,top:2.05,slot,phase});
   const overlaps=marks.some(m=>m.face.id===face.id&&Math.abs(m.wallU-placement.u)<m.halfAlong+placement.halfAlong+.08&&Math.abs(m.centreY-placement.centreY)<m.halfUp+placement.halfUp+.08);
   return {face,placement,overlaps,score:(usedRooms.has(face.roomIndex)?0:100)+(usedFaces.has(face.id)?0:20)+r.n()};
  }).filter(c=>!c.overlaps).sort((a,b)=>b.score-a.score);
  const chosen=candidates[0];if(!chosen)throw new Error('No clear interior tag position on '+layout.date);
  const {face,placement:p}=chosen,normal={...face.normal,y:0},right={x:normal.z,z:-normal.x};
  usedRooms.add(face.roomIndex);usedFaces.add(face.id);
  marks.push({id:item.id,date:layout.date,level,slot,phrase,text:tag.text,hand:tag.hand,form:'handstyle',surface:'interior',ink,seed:tag.seed,
   face,width:p.width,height:p.height,rotation:p.rotation,phi:p.phi,wallU:p.u,centreY:p.centreY,halfAlong:p.halfAlong,halfUp:p.halfUp,normal,
   position:{x:face.centre.x+right.x*p.u,y:level*floorSpacing+face.roomY+p.centreY,z:face.centre.z+right.z*p.u},bounds:{...tag.bounds},tag});
 }
 return marks;
}
