// Deterministically prebuild the entire archived tower during the final
// gallery publish. The browser receives mesh buffers (not procedural boxes).
// There are no runtime/CDN dependencies: only Node 22 and layout-v2.mjs.
import fs from 'node:fs/promises';
import {gzipSync, gunzipSync} from 'node:zlib';
import {buildLayout,DOOR_WIDTH,DOOR_HEIGHT,ROOM_HEIGHT} from '../gallery/visit/layout-v2.mjs';

const root=new URL('../gallery/',import.meta.url);
const manifestPath=new URL('tower-layouts.json',root);
const outputPath=new URL('tower-geometry.bin.gz',root);
const FLOOR_SPACING=6.2;
const TILE={floor:2.25,roof:1.15,join:.8,plinth:1.15,brick:2,
  skylight:0,wall:2.7};
const encoder=new TextEncoder();
const source=JSON.parse(await fs.readFile(manifestPath,'utf8'));
if(source.version!==1||!Array.isArray(source.floors)||!source.floors.length)
  throw Error('Cannot prebuild tower: invalid daily floor index');
const dataChunks=[];
let binaryBytes=0;
const append=array=>{
  const byteLength=array.byteLength;
  if(byteLength%4!==0)throw Error('Unaligned tower geometry section');
  const part=Buffer.from(array.buffer,array.byteOffset,byteLength);
  const range=[binaryBytes,byteLength];
  dataChunks.push(part);
  binaryBytes+=byteLength;
  return range;
};
function compileFloor(floor,level,highest){
  const studies=floor.studies.map(([seed,engine])=>({seed,engine}));
  const plan=buildLayout(floor.date,studies.length,studies);
  const buckets=new Map();
  const put=(w,h,d,x,y,z,material='wall')=>{
    if(w<=0||h<=0||d<=0)return;
    if(!buckets.has(material))buckets.set(material,[]);
    buckets.get(material).push([w,h,d,x,y,z]);
  };
  const bridges=[];
  const base=level*FLOOR_SPACING;
  for(const room of plan.rooms){
    const y=base+room.y;
    put(room.width+.42,.35,room.depth+.42,room.x,y-.2,room.z,'floor');
    if(level===highest){
      const strip=(room.width-3.5)/2;
      for(const sign of [-1,1]){
        put(strip,.24,room.depth+.45,
          room.x+sign*(room.width+3.5)/4,y+ROOM_HEIGHT+.15,room.z,'roof');
        put(strip,.17,room.depth+.94,
          room.x+sign*(room.width+3.5)/4,y+ROOM_HEIGHT+.32,room.z,'roof');
      }
      put(3.5,.085,room.depth+.38,room.x,y+ROOM_HEIGHT+.105,room.z,'skylight');
    }else{
      put(room.width+.45,.24,room.depth+.45,room.x,y+ROOM_HEIGHT+.15,room.z,'roof');
      put(room.width+.94,.17,room.depth+.94,room.x,y+ROOM_HEIGHT+.32,room.z,'roof');
    }
    put(room.width+.76,.12,room.depth+.76,room.x,y+ROOM_HEIGHT-.09,room.z,'join');
    if(level===highest){
      const edgeY=y+ROOM_HEIGHT+.66;
      for(const sign of [-1,1]){
        put(room.width+1.05,.53,.22,room.x,edgeY,room.z+sign*(room.depth+.87)/2,'plinth');
        put(.22,.53,room.depth+.95,room.x+sign*(room.width+.87)/2,edgeY,room.z,'plinth');
      }
    }
    for(const side of ['north','south','east','west']){
      const horizontal=side==='north'||side==='south';
      const length=horizontal?room.width:room.depth;
      const fixed=horizontal?room.z+(side==='north'?-room.depth/2:room.depth/2):
        room.x+(side==='west'?-room.width/2:room.width/2);
      const wallPart=(span,height,offset,yCentre,material='brick')=>{
        if(horizontal)put(span,height,.34,room.x+offset,yCentre,fixed,material);
        else put(.34,height,span,fixed,yCentre,room.z+offset,material);
      };
      const centre=y+ROOM_HEIGHT/2;
      // The only external glass on the tower is skybridges and skylights.
      if(horizontal){
        put(length+.13,.085,.10,room.x,y+.32,fixed,'join');
        put(length+.13,.085,.10,room.x,y+ROOM_HEIGHT-.36,fixed,'join');
      }else{
        put(.10,.085,length+.13,fixed,y+.32,room.z,'join');
        put(.10,.085,length+.13,fixed,y+ROOM_HEIGHT-.36,room.z,'join');
      }
      if(room.doors.includes(side)){
        const opening=DOOR_WIDTH,wing=(length-opening)/2,doorHeight=DOOR_HEIGHT;
        wallPart(wing,ROOM_HEIGHT,-(opening+wing)/2,centre);
        wallPart(wing,ROOM_HEIGHT,(opening+wing)/2,centre);
        wallPart(opening,ROOM_HEIGHT-doorHeight,0,y+(ROOM_HEIGHT+doorHeight)/2);
        continue;
      }
      // Match the occupied gallery: intact brick wall, no outside windows.
      wallPart(length,ROOM_HEIGHT,0,centre);
    }
  }
  for(const hall of plan.corridors)
    bridges.push({start:{x:hall.start.x,y:base+hall.start.y,z:hall.start.z},
      end:{x:hall.end.x,y:base+hall.end.y,z:hall.end.z}});
  const batches=[];
  for(const [material,boxes] of buckets){
    const vertices=boxes.length*24, triangles=boxes.length*12;
    const position=new Float32Array(vertices*3);
    const normal=new Float32Array(vertices*3);
    const uv=new Float32Array(vertices*2);
    const index=new Uint32Array(triangles*3);
    let v=0,i=0;
    const faces=[
      {u:2,t:1,w:0,ud:-1,vd:-1,sgn:1,uw:2,vh:1},
      {u:2,t:1,w:0,ud:1,vd:-1,sgn:-1,uw:2,vh:1},
      {u:0,t:2,w:1,ud:1,vd:1,sgn:1,uw:0,vh:2},
      {u:0,t:2,w:1,ud:1,vd:-1,sgn:-1,uw:0,vh:2},
      {u:0,t:1,w:2,ud:1,vd:-1,sgn:1,uw:0,vh:1},
      {u:0,t:1,w:2,ud:-1,vd:-1,sgn:-1,uw:0,vh:1}
    ];
    for(const [w,h,d,x,y,z] of boxes){
      const dim=[w,h,d],loc=[x,y,z],tile=TILE[material]||0;
      for(const face of faces){
        const start=v;
        for(let iy=0;iy<2;iy++)for(let ix=0;ix<2;ix++){
          const coords=[0,0,0],n=[0,0,0];
          coords[face.u]=(ix-.5)*dim[face.u]*face.ud;
          coords[face.t]=(iy-.5)*dim[face.t]*face.vd;
          coords[face.w]=.5*dim[face.w]*face.sgn;
          n[face.w]=face.sgn;
          const p=v*3,t=v*2;
          for(let k=0;k<3;k++){position[p+k]=coords[k]+loc[k];normal[p+k]=n[k];}
          uv[t]=ix*(tile?Math.max(.001,dim[face.uw]/tile):1);
          uv[t+1]=(1-iy)*(tile?Math.max(.001,dim[face.vh]/tile):1);
          v++;
        }
        for(const k of [0,2,1,2,3,1])index[i++]=start+k;
      }
    }
    batches.push({material,vertexCount:vertices,indexCount:index.length,
      position:append(position),normal:append(normal),uv:append(uv),
      index:append(index)});
  }
  return {date:floor.date,
    signature:floor.studies.map(([seed,mode])=>seed+':'+mode).join('|'),
    roomCount:plan.rooms.length,bridges,batches};
}
const floors=source.floors.map((f,i)=>compileFloor(f,i,source.floors.length-1));
const metadata={version:2,createdFor:source.floors.at(-1).date,days:floors.length,floors};
const head=Buffer.from(encoder.encode(JSON.stringify(metadata)));
const dataStart=Math.ceil((4+head.length)/4)*4;
const packed=Buffer.allocUnsafe(dataStart+binaryBytes);
packed.fill(0,0,dataStart);
packed.writeUInt32LE(head.length,0);
head.copy(packed,4);
let cursor=dataStart;
for(const chunk of dataChunks){chunk.copy(packed,cursor);cursor+=chunk.length;}
const compressed=gzipSync(packed,{level:9});
const decoded=gunzipSync(compressed);
const metaLength=decoded.readUInt32LE(0);
const check=JSON.parse(decoded.subarray(4,4+metaLength).toString('utf8'));
if(check.floors.length!==source.floors.length||check.version!==2||decoded.length!==packed.length)
  throw Error('Compressed tower validation failed');
await fs.writeFile(outputPath,compressed);
const count=floors.reduce((n,f)=>n+f.batches.reduce((s,b)=>s+b.vertexCount/24,0),0);
console.log('Prebuilt tower:',floors.length,'floors,',count,'architectural boxes,',
  compressed.length,'bytes compressed (',packed.length,'bytes expanded )');
