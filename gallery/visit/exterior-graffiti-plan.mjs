// One stable selection per exhibition. Wall placement is independent of the
// occupied floor and of whether the surrounding tower uses prepared meshes.
import {makeRandom} from '../../test/graffiti/tag-engine.mjs?v=sprayed-throwups-v7';
import {makeTowerFamilyTag,towerGraffitiSignature,TOWER_LETTERING_REVISION} from './tower-family-lettering.mjs';
import {ROOM_HEIGHT} from './layout-v2.mjs';
import {fitPhiTag} from './graffiti-placement.mjs';
import {TOWER_HANDS,towerHandCycle,towerTagSlot} from './tower-graffiti-styles.mjs';
export const GRAFFITI_WORDS=Object.freeze(['φ']);
export const GRAFFITI_SEED='PP-TOWER-SPREAD-PHI-04';
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
 const ordered=floors.filter(f=>f.level===0||f.level===1).sort((a,b)=>a.level-b.level);
 const marks=[];
 for(const {level,plan} of ordered){
  const faces=exteriorWallFaces(plan,level===0).filter(face=>face.exposed);
  if(!faces.length)throw new Error('No exposed exterior graffiti wall on '+plan.date);
  const hands=towerHandCycle(seed+'|'+plan.date+'|layered-phi');
  const front=faces.filter(face=>face.side==='south');
  const featured=(front.length?front:faces).sort((a,b)=>b.length-a.length)[0];
  // Paint order is large, three medium, five small, then eight handwritten.
  for(let slot=0;slot<17;slot++){
   const tier=slot===0?0:slot<4?1:slot<9?2:3;
   const item=towerTagSlot({floorId:plan.date,seed:seed+'|layered|'+slot,slot,hand:hands[slot%hands.length]});
   const tag=makeTowerFamilyTag('φ',{...item,paintWidth:[3,2.1,1.45,.88][tier]});
   const face=featured;
   // Smaller work is placed over the same central cluster, rather than
   // rejecting overlaps. The golden angle disperses the handwriting.
   const placement=fitPhiTag({bounds:tag.bounds,desiredWidth:[Math.min(6,face.length-.9),2.7,1.4,.65][tier],
    maxHeight:ROOM_HEIGHT-1.2,lo:-face.length/2+WALL_MARGIN,hi:face.length/2-WALL_MARGIN,
    bottom:.5,top:ROOM_HEIGHT-.4,slot:slot+17,phase:slot*3});
   const normal=face.normal,right={x:normal.z,z:-normal.x};
   const angle=slot* Math.PI*(3-Math.sqrt(5)),radius=tier===0?0:[0,.24,.55,.9][tier];
   const u=Math.max(-face.length/2+placement.width/2+.15,
    Math.min(face.length/2-placement.width/2-.15,Math.cos(angle)*radius*(face.length/2-placement.width/2-.22)*.95));
   // Fit the rotated bounding box, not the unrotated dimensions. The
   // earlier clamp let rotated phi tags enter the roof/floor safety bands.
   const rotation=placement.rotation*.45;
   const c=Math.abs(Math.cos(rotation)),s=Math.abs(Math.sin(rotation));
   const rotatedW=placement.width*c+placement.height*s;
   const rotatedH=placement.height*c+placement.width*s;
   const scale=Math.min(1,(face.length-2*WALL_MARGIN)/rotatedW,(ROOM_HEIGHT-1.2)/rotatedH);
   const width=placement.width*scale,height=placement.height*scale;
   const halfW=(width*c+height*s)/2,halfH=(height*c+width*s)/2;
   const safeU=Math.max(-face.length/2+WALL_MARGIN+halfW,
    Math.min(face.length/2-WALL_MARGIN-halfW,u));
   const centreY=Math.max(.65+halfH,
    Math.min(ROOM_HEIGHT-.55-halfH,ROOM_HEIGHT/2+Math.sin(angle)*radius*(ROOM_HEIGHT/2-halfH-.65)*.9));
   marks.push({id:item.id,date:plan.date,level,slot,surface:'exterior',phi:{...placement.phi,tier},
    phrase:'φ',text:tag.text,hand:tag.hand,form:tier===3?'handstyle':tag.form,
    ink:tag.ink,seed:tag.seed,face,width,height,
    rotation,normal:{x:normal.x,y:0,z:normal.z},
    position:{x:face.centre.x+right.x*safeU+normal.x*tier*.007,
     y:level*floorSpacing+face.roomY+centreY,
     z:face.centre.z+right.z*safeU+normal.z*tier*.007},
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
