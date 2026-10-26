// One stable selection per exhibition. Wall placement is independent of the
// occupied floor and of whether the surrounding tower uses prepared meshes.
import {makeRandom} from '../../test/graffiti/tag-engine.mjs?v=sprayed-throwups-v7';
import {makeTowerFamilyTag,towerGraffitiSignature,TOWER_LETTERING_REVISION} from './tower-family-lettering.mjs';
import {ROOM_HEIGHT} from './layout-v2.mjs';
import {fitPhiTag} from './graffiti-placement.mjs';
import {TOWER_HANDS,towerHandCycle,towerTagSlot} from './tower-graffiti-styles.mjs';
export const GRAFFITI_WORDS=Object.freeze(['Proportion Piece','PHI','φ']);
export const GRAFFITI_SEED='PP-TOWER-WRITING-01';
export const WALL_MARGIN=.52;
export const TAGS_PER_PAINTED_FLOOR=5;
const SIDES=['north','south','east','west'];
const normals={north:{x:0,z:-1},south:{x:0,z:1},east:{x:1,z:0},west:{x:-1,z:0}};
export function reservedWalls(room,ground=false){
 if(room.index!==0)return [];
 const lift=SIDES.find(side=>!room.doors.includes(side));
 const entrance=ground?['south','east','west','north'].find(side=>side!==lift&&!room.doors.includes(side)):null;
 return [lift,entrance].filter(Boolean);
}
export function exteriorWallFaces(layout,ground=false){
 const faces=[];
 for(const room of layout.rooms)for(const side of SIDES){
  if(room.doors.includes(side)||reservedWalls(room,ground).includes(side))continue;
  const normal=normals[side],horizontal=!normal.x,length=horizontal?room.width:room.depth;
  const fixed=horizontal?room.z+normal.z*room.depth/2:room.x+normal.x*room.width/2;
  // Prefer a facade visible from open space, rather than the back of a room
  // hidden by another room in the same row or column.
  const exposed=!layout.rooms.some(other=>{
   if(other===room)return false;
   const forward=(other.x-room.x)*normal.x+(other.z-room.z)*normal.z;
   const cross=Math.abs(horizontal?other.x-room.x:other.z-room.z);
   return forward>0&&cross<(length+(horizontal?other.width:other.depth))/2-.1;
  });
  faces.push({id:room.index+':'+side,roomIndex:room.index,side,normal:{...normal},length,fixed,roomY:room.y,
   centre:{x:horizontal?room.x:fixed,z:horizontal?fixed:room.z},exposed});
 }
 return faces;
}
export function towerGraffitiKey(floors){
 return TOWER_LETTERING_REVISION+'|'+floors.filter(f=>f.level===0||f.level===1).map(({level,plan})=>level+':'+plan.date+':'+plan.rooms.map(r=>[r.x,r.z,r.width,r.depth,r.y].map(v=>Number(v.toFixed(6))).join(',')).join(';')).join('|');
}
export function planExteriorGraffiti(floors,{seed=GRAFFITI_SEED,floorSpacing=6.2}={}){
 if(!floors.length)return [];
 const ordered=floors.filter(f=>f.level===0||f.level===1).sort((a,b)=>a.level-b.level),ground=ordered.find(f=>f.level===0)?.plan;
 const entry=ground?.rooms[0],front=entry?normals[reservedWalls(entry,true).at(-1)]||normals.south:normals.south;
 const marks=[];
 for(const {level,plan} of ordered){
  const faces=exteriorWallFaces(plan,level===0),wordRandom=makeRandom(seed+'|'+plan.date+'|words');
  const firstWord=wordRandom.int(0,GRAFFITI_WORDS.length-1),phase=wordRandom.int(0,31);
  const styles=towerHandCycle(seed+'|'+plan.date+'|all-outside');
  const selection=Array.from({length:TAGS_PER_PAINTED_FLOOR},(_,slot)=>
   towerTagSlot({floorId:plan.date,seed:seed+'|slot|'+slot,slot,hand:styles[slot]}));
  for(const item of selection){
   const phrase=GRAFFITI_WORDS[(firstWord+item.slot)%GRAFFITI_WORDS.length];
   const tag=makeTowerFamilyTag(phrase,{...item,paintWidth:2}),r=makeRandom(item.seed+'|wall');
   const desiredWidth=phrase==='Proportion Piece'?r.range(5.7,6.9):phrase==='PHI'?r.range(2.4,3.5):r.range(1.5,2.1);
   const candidates=faces.map(face=>{
    const placement=fitPhiTag({bounds:tag.bounds,desiredWidth,maxHeight:ROOM_HEIGHT-1.5,
     lo:-face.length/2+WALL_MARGIN,hi:face.length/2-WALL_MARGIN,bottom:.65,top:ROOM_HEIGHT-.55,slot:item.slot,phase});
    const facing=face.normal.x*front.x+face.normal.z*front.z;
    const right={x:face.normal.z,z:-face.normal.x},c=Math.abs(Math.cos(placement.rotation)),sn=Math.abs(Math.sin(placement.rotation));
    const hw=(placement.width*c+placement.height*sn)/2,hh=(placement.height*c+placement.width*sn)/2;
    const neighbours=marks.filter(m=>m.level===level&&m.face.id===face.id);
    const overlap=neighbours.reduce((area,m)=>{
     const mw=(Math.abs(m.width*Math.cos(m.rotation))+Math.abs(m.height*Math.sin(m.rotation)))/2;
     const mh=(Math.abs(m.height*Math.cos(m.rotation))+Math.abs(m.width*Math.sin(m.rotation)))/2;
     const mu=(m.position.x-face.centre.x)*right.x+(m.position.z-face.centre.z)*right.z;
     const my=m.position.y-level*floorSpacing-face.roomY;
     const dx=Math.max(0,Math.min(placement.u+hw,mu+mw)-Math.max(placement.u-hw,mu-mw));
     const dy=Math.max(0,Math.min(placement.centreY+hh,my+mh)-Math.max(placement.centreY-hh,my-mh));
     return area+dx*dy;
    },0);
    return {face,...placement,score:(face.exposed?4:0)+facing*3+r.range(0,.1)-overlap*100-neighbours.length*2};

   }).sort((a,b)=>b.score-a.score);
   const chosen=candidates[0];if(!chosen)throw new Error('No exterior wall for '+plan.date);
   const {face,width,height,rotation,u:shift,centreY,phi}=chosen;
   const normal=face.normal,right={x:normal.z,z:-normal.x};
   marks.push({id:item.id,date:plan.date,level,slot:item.slot,surface:'exterior',phi,phrase,text:tag.text,hand:tag.hand,form:tag.form,ink:tag.ink,seed:tag.seed,
    face,width,height,rotation,normal:{x:normal.x,y:0,z:normal.z},
    position:{x:face.centre.x+right.x*shift,y:level*floorSpacing+face.roomY+centreY,z:face.centre.z+right.z*shift},
    bounds:{...tag.bounds},tag});
  }
 }
 // Fifteen supplemental signatures per painted floor, including large-format tags, using different freehand writer
 // profiles from any previously selected on its outward-facing facade.
 for(const {level,plan} of ordered){
  const faces=exteriorWallFaces(plan,level===0);
  const frontFaces=faces.filter(face=>face.exposed&&face.normal.x===front.x&&face.normal.z===front.z);
  const candidates=frontFaces.length?frontFaces:faces.filter(face=>face.exposed);
  const existing=marks.filter(mark=>mark.level===level);
  const occupied=new Set(existing.map(mark=>mark.hand));
  const dialects=towerHandCycle(seed+'|'+plan.date+'|all-outside');
  for(let extra=0;extra<15;extra++){
   const slot=TAGS_PER_PAINTED_FLOOR+extra;
   const hand=dialects.find(id=>!occupied.has(id)) || dialects[extra%dialects.length];
   // Nine approved families cover ten facade tags; repeat only after exhaustion.
   occupied.add(hand);
   const item=towerTagSlot({floorId:plan.date,seed:seed+'|front-freehand|'+slot,slot,hand});
   const phrase=extra<5?GRAFFITI_WORDS[(extra+level)%GRAFFITI_WORDS.length]:extra<10?['Proportion','Piece','PHI','φ','Proportion Piece'][extra-5]:['Proportion','Piece','Proportion Piece','PHI','φ'][extra-10];
   if(phrase==='Piece')continue;
   const tag=makeTowerFamilyTag(phrase,{...item,paintWidth:2});
   const r=makeRandom(item.seed+'|front-wall'),epic=extra>=10&&extra<=12;
   const desiredWidth=epic?(phrase==='Proportion Piece'?r.range(8,10.5):phrase==='Proportion'?r.range(7,9.5):r.range(5.5,7.5)):
    phrase==='Proportion Piece'?r.range(3.2,4.3):phrase==='PHI'?r.range(1.7,2.5):phrase==='Proportion'?r.range(3,4.1):phrase==='Piece'?r.range(2.2,3.1):r.range(1.1,1.6);
   // Try several phi-phased placements on each wall rather than stacking
   // every additional mark at the same five golden fractions.
   const placed=[1,.82,.66,.52].flatMap(shrink=>candidates.flatMap(face=>Array.from({length:epic?30:18},(_,attempt)=>{
    const p=fitPhiTag({bounds:tag.bounds,desiredWidth:desiredWidth*shrink,maxHeight:ROOM_HEIGHT-1.5,
     lo:-face.length/2+WALL_MARGIN,hi:face.length/2-WALL_MARGIN,bottom:.65,top:ROOM_HEIGHT-.55,slot:slot+attempt*3,phase:extra*7+attempt*11});
    const cos=Math.abs(Math.cos(p.rotation)),sin=Math.abs(Math.sin(p.rotation));
    const hw=(p.width*cos+p.height*sin)/2,hh=(p.height*cos+p.width*sin)/2;
    const right={x:face.normal.z,z:-face.normal.x};
    const neighbours=marks.filter(m=>m.level===level&&m.face.id===face.id);
    const overlap=neighbours.reduce((sum,m)=>{
     const mw=(Math.abs(m.width*Math.cos(m.rotation))+Math.abs(m.height*Math.sin(m.rotation)))/2;
     const mh=(Math.abs(m.height*Math.cos(m.rotation))+Math.abs(m.width*Math.sin(m.rotation)))/2;
     const mu=(m.position.x-face.centre.x)*right.x+(m.position.z-face.centre.z)*right.z;
     const my=m.position.y-level*floorSpacing-face.roomY;
     const dx=Math.max(0,Math.min(p.u+hw,mu+mw)-Math.max(p.u-hw,mu-mw));
     const dy=Math.max(0,Math.min(p.centreY+hh,my+mh)-Math.max(p.centreY-hh,my-mh));
     return sum+dx*dy;
    },0);
    return {face,...p,overlap,score:overlap*1000+(neighbours.length*.12)+attempt*.002+(1-shrink)*.25};
   }))).filter(p=>p.width>0&&p.height>0).sort((a,b)=>a.score-b.score);
   // Do not place one tag on top of another: an oversized tag can shrink or be omitted.
   const chosen=placed.find(p=>p.overlap<.015);if(!chosen)continue;
   const {face,width,height,rotation,u:shift,centreY,phi}=chosen;
   const normal=face.normal,right={x:normal.z,z:-normal.x};
   marks.push({id:item.id,date:plan.date,level,slot,surface:'exterior',phi,phrase,text:tag.text,hand:tag.hand,form:'handstyle',ink:tag.ink,seed:tag.seed,
    face,width,height,rotation,normal:{x:normal.x,y:0,z:normal.z},
    position:{x:face.centre.x+right.x*shift,y:level*floorSpacing+face.roomY+centreY,z:face.centre.z+right.z*shift},
    bounds:{...tag.bounds},tag});
  }
 }
 return marks;
}
export {towerGraffitiSignature};
export function planGraffitiAtlases(marks,{lowPower=false}={}){
 const size=lowPower?1536:2048,cellWidth=size/4,cellHeight=size/8,capacity=32,padding=13;
 return Array.from({length:Math.ceil(marks.length/capacity)},(_,page)=>({size,page,height:Math.ceil(Math.min(capacity,marks.length-page*capacity)/4)*cellHeight,
  entries:marks.slice(page*capacity,(page+1)*capacity).map((mark,index)=>{
   const aspect=mark.bounds.width/mark.bounds.height;
   const width=Math.min(cellWidth-padding*2,(cellHeight-padding*2)*aspect),height=width/aspect;
   return {mark,x:(index%4)*cellWidth+(cellWidth-width)/2,y:Math.floor(index/4)*cellHeight+(cellHeight-height)/2,width,height};
  })}));
}
