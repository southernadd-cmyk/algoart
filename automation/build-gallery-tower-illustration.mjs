// Architectural editorial illustration of the ACTUAL lower gallery tower.
// Import the production layout engine: never make up a repeated facade.
// Render at most the oldest fifteen floors on a fixed-size, cropped canvas.
// Source: gallery/tower-layouts.json, refreshed by build-gallery.mjs.
import fs from 'node:fs/promises';
import {buildLayout,ROOM_HEIGHT,DOOR_WIDTH,DOOR_HEIGHT} from '../gallery/visit/layout-v2.mjs';

const root=new URL('../gallery/',import.meta.url);
const source=JSON.parse(await fs.readFile(new URL('tower-layouts.json',root),'utf8'));
if(source.version!==1||!Array.isArray(source.floors)||!source.floors.length)
  throw Error('Missing real tower floor records');
const entries=source.floors.slice(0,15);
const plans=entries.map(f=>({
  date:f.date,
  plan:buildLayout(f.date,f.studies.length,f.studies.map(([seed,engine])=>({seed,engine})))
}));
const FLOOR_SPACING=6.2;
const width=1200,height=480;
const groundY=432;
const metresToPixels=5.0;
const depthShift=.45;
const horizScale=5.25;
const centreX=590;
const rootEntry=plans[0].plan.rooms[0];
const freeSides=['north','east','south','west'];
rootEntry.liftWall=freeSides.find(side=>!rootEntry.doors.includes(side));
rootEntry.entranceWall=freeSides.find(side=>side!==rootEntry.liftWall&&!rootEntry.doors.includes(side));
if(!rootEntry.entranceWall)throw Error('Ground entrance cannot face out of the building');

const unit={
  north:{x:0,z:-1},south:{x:0,z:1},
  east:{x:1,z:0},west:{x:-1,z:0}
};
const outward=unit[rootEntry.entranceWall];
// Look from the actual street entrance, shifted for a readable side view.
const tangent={x:outward.z,z:-outward.x};
const view={x:outward.x*.82+tangent.x*.57,z:outward.z*.82+tangent.z*.57};
const size=Math.hypot(view.x,view.z);
view.x/=size;view.z/=size;
const screenRight={x:view.z,z:-view.x};
const f=n=>Number(n.toFixed(2));
const xy=(x,y,z)=>[
  f(centreX+horizScale*(x*screenRight.x+z*screenRight.z)),
  f(groundY-y*metresToPixels+depthShift*(x*view.x+z*view.z))
];
const points=(verts)=>verts.map(v=>xy(v[0],v[1],v[2]));
const pts=a=>a.map(p=>p[0]+','+p[1]).join(' ');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const svg=[];
const emit=s=>svg.push(s);
const shape=(verts,fill,stroke='#58685e',line=1.4,other='')=>
  emit('<polygon points="'+pts(points(verts))+'" fill="'+fill+
    '" stroke="'+stroke+'" stroke-width="'+line+'" stroke-linejoin="round" '+other+'/>');
const line=(a,b,color='#77887f',thickness=1,other='')=>{
  const v=xy(...a),w=xy(...b);
  emit('<path d="M'+v[0]+' '+v[1]+'L'+w[0]+' '+w[1]+
    '" fill="none" stroke="'+color+'" stroke-width="'+thickness+'" '+other+'/>');
};
const face=(room,side,yBottom,yTop)=>{
  const x=room.x,z=room.z,w=room.width/2,d=room.depth/2;
  if(side==='south')return [[x-w,yBottom,z+d],[x+w,yBottom,z+d],[x+w,yTop,z+d],[x-w,yTop,z+d]];
  if(side==='north')return [[x+w,yBottom,z-d],[x-w,yBottom,z-d],[x-w,yTop,z-d],[x+w,yTop,z-d]];
  if(side==='east')return [[x+w,yBottom,z+d],[x+w,yBottom,z-d],[x+w,yTop,z-d],[x+w,yTop,z+d]];
  return [[x-w,yBottom,z-d],[x-w,yBottom,z+d],[x-w,yTop,z+d],[x-w,yTop,z-d]];
};
function solidRoom(room,level,base){
  const bottom=base+room.y,top=bottom+ROOM_HEIGHT;
  const d=room.depth/2,w=room.width/2;
  const sides=Object.entries(unit)
    .filter(([,v])=>v.x*view.x+v.z*view.z>.025)
    .sort((a,b)=>(a[1].x*view.x+a[1].z*view.z)-(b[1].x*view.x+b[1].z*view.z));
  const tones=['#ab9180','#b99d8b','#c1a491','#a88c7c'];
  for(const [side] of sides){
    const light=side==='south'||side==='east';
    const tone=tones[(room.index+level+(light?2:0))%tones.length];
    shape(face(room,side,bottom,top),tone,'#69584e',1.35,'class="solid-brick-wall"');
    // Staggered mortar courses: solid brick, not glass panels.
    const wallFace=face(room,side,bottom,top);
    for(let course=1;course<7;course++){
      const t=course/7;
      const a=wallFace[0].map((v,k)=>v+(wallFace[3][k]-v)*t);
      const b=wallFace[1].map((v,k)=>v+(wallFace[2][k]-v)*t);
      line(a,b,'#e3d0bb',.7,'opacity=".52" class="brick-mortar"');
      for(let brick=1;brick<5;brick++){
        const frac=(brick+((course%2)*.5))/5;
        if(frac>=1)continue;
        const baseEdge=a.map((v,k)=>v+(b[k]-v)*frac);
        const topEdge=baseEdge.map((v,k)=>v+(wallFace[3][k]-wallFace[0][k])/7);
        line(baseEdge,topEdge,'#705d50',.55,'opacity=".30" class="brick-mortar"');
      }
    }
    const sill=face(room,side,bottom+.35,bottom+.35);
    line(sill[0],sill[1],'#9ba99c',.9,'opacity=".52"');
    const lintel=face(room,side,top-.35,top-.35);
    line(lintel[0],lintel[1],'#99a99e',1.05,'opacity=".62"');
    // Connected rooms really have a doorway into a glass bridge; there are
    // NO exterior windows in the virtual exhibition.
    if(room.doors.includes(side)){
      const n=unit[side],along={x:-n.z,z:n.x};
      const half=DOOR_WIDTH/2, cx=room.x+n.x*(side==='east'||side==='west'?w:d),
        cz=room.z+n.z*(side==='east'||side==='west'?w:d);
      const door=[
        [cx-along.x*half,bottom,cz-along.z*half],
        [cx+along.x*half,bottom,cz+along.z*half],
        [cx+along.x*half,bottom+DOOR_HEIGHT,cz+along.z*half],
        [cx-along.x*half,bottom+DOOR_HEIGHT,cz-along.z*half]
      ];
      shape(door,'#77685d','#69594f',.7,'opacity=".88" class="solid-door-recess"');
    }
  }
  shape([
    [room.x-w-.22,top+.2,room.z-d-.22],[room.x+w+.22,top+.2,room.z-d-.22],
    [room.x+w+.22,top+.2,room.z+d+.22],[room.x-w-.22,top+.2,room.z+d+.22]
  ],'#a6b3a7','#647569',1.05);
  // The actual horizontal floor/roof slab dimensions from production.
  const slab=bottom-.2;
  shape([
    [room.x-w-.21,slab,room.z-d-.21],[room.x+w+.21,slab,room.z-d-.21],
    [room.x+w+.21,slab,room.z+d+.21],[room.x-w-.21,slab,room.z+d+.21]
  ],'#9fac9e','#5e7365',1.1,'opacity=".93"');
}
function glassBridge(hall,base){
  const a=hall.start,b=hall.end;
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
  if(len<.2)return;
  const cross={x:-dz/len,z:dx/len};
  const w=DOOR_WIDTH/2;
  const ends=(p,y)=>[
    [p.x-cross.x*w,y,p.z-cross.z*w],
    [p.x+cross.x*w,y,p.z+cross.z*w]
  ];
  const y1=base+a.y,y2=base+b.y;
  const aa=ends(a,y1),bb=ends(b,y2);
  const ah=ends(a,y1+DOOR_HEIGHT),bh=ends(b,y2+DOOR_HEIGHT);
  shape([aa[0],bb[0],bh[0],ah[0]],'#bed2cd','#5d7c75',1.4,'opacity=".94" class="glass-walkway"');
  shape([aa[1],bb[1],bh[1],ah[1]],'#cbdcd7','#63827a',1.4,'opacity=".87" class="glass-walkway"');
  shape([ah[0],bh[0],bh[1],ah[1]],'#d5e3df','#63827a',1.05,'opacity=".9" class="glass-walkway"');
  // Actual cross-brace spans, not imaginary projecting wings.
  line(aa[0],bh[0],'#849d96',.9,'opacity=".7"');
  line(aa[1],bh[1],'#849d96',.9,'opacity=".7"');
}
function liftCore(room,base){
  const side=freeSides.find(s=>!room.doors.includes(s));
  if(!side)return;
  const normal=unit[side],offset=(side==='north'||side==='south'?room.depth:room.width)/2+1.0;
  const cx=room.x+normal.x*offset,cz=room.z+normal.z*offset;
  const core={x:cx,z:cz,y:0,width:2.2,depth:2.2,index:-1,doors:[]};
  // A small exterior lift housing, consistently adjacent to room zero.
  solidRoom(core,-1,base+room.y);
}
function entrance(room){
  const normal=unit[rootEntry.entranceWall];
  const along={x:-normal.z,z:normal.x};
  const edge=(Math.abs(normal.x)?room.width:room.depth)/2;
  const cx=room.x+normal.x*edge,cz=room.z+normal.z*edge;
  const p=(offset,h)=>[cx+along.x*offset+normal.x*.045,room.y+h,
                       cz+along.z*offset+normal.z*.045];
  shape([p(-2.55,0),p(2.55,0),p(2.55,4.35),p(-2.55,4.35)],
    '#b5bfb2','#5f7366',1.65);
  shape([p(-1.8,.08),p(1.8,.08),p(1.8,3.65),p(-1.8,3.65)],
    '#314940','#314940',1.2);
  line(p(0,.1),p(0,3.65),'#b1c0b4',1.65);
  shape([p(-2.7,4.32),p(2.7,4.32),p(2.7,4.63),p(-2.7,4.63)],
    '#b8bdb0','#667a6d',1.1);
}
emit('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+
  '" viewBox="0 0 '+width+' '+height+
  '" role="img" aria-label="Architecturally derived view of the first fifteen virtual gallery floors; the real rooms, solid walls, entrance and glass bridges continue above the frame">');
emit('<defs><linearGradient id="sky" x2=".06" y2="1"><stop stop-color="#c1cec7"/><stop offset="1" stop-color="#e8eae3"/></linearGradient></defs>');
emit('<rect width="1200" height="480" fill="url(#sky)"/>');
emit('<g opacity=".27" fill="#80938a"><rect x="18" y="191" width="83" height="184"/><rect x="127" y="147" width="64" height="229"/><rect x="220" y="236" width="104" height="140"/><rect x="838" y="164" width="87" height="212"/><rect x="940" y="209" width="91" height="167"/><rect x="1052" y="126" width="114" height="250"/></g>');
emit('<path d="M0 394Q180 350 334 383Q600 428 793 377Q1027 331 1200 388V480H0Z" fill="#89968d"/>');
let highY=Infinity,totalRooms=0,totalBridges=0;
// The real plans are built per archived seed, then arranged at 6.2m storey
// spacing just as the running WebGL and baked tower mesh do.
for(let level=0;level<plans.length;level++){
  const {date,plan}=plans[level],base=level*FLOOR_SPACING;
  totalRooms+=plan.rooms.length;totalBridges+=plan.corridors.length;
  emit('<g data-floor="'+date+'" data-room-count="'+plan.rooms.length+
    '" data-bridge-count="'+plan.corridors.length+'">');
  // Bridges are behind their adjoining opaque rooms, exactly as built.
  for(const hall of plan.corridors)glassBridge(hall,base);
  const sorted=[...plan.rooms].sort((a,b)=>
    ((a.x*view.x+a.z*view.z)-(b.x*view.x+b.z*view.z)));
  liftCore(plan.rooms[0],base);
  for(const room of sorted)solidRoom(room,level,base);
  if(level===0)entrance(plan.rooms[0]);
  for(const room of plan.rooms){
    const top=base+room.y+ROOM_HEIGHT+.33;
    const t=xy(room.x,top,room.z)[1];
    highY=Math.min(highY,t);
  }
  emit('</g>');
}
emit('<path d="M0 426L1200 411V480H0Z" fill="#a7aa9f"/>');
emit('<path d="M0 437L1200 423" stroke="#e1e2d8" stroke-width="3.5"/>');
emit('<path d="M160 426Q157 393 196 369Q238 386 222 426Z" fill="#6f8579" stroke="#50665a" stroke-width="2.5"/>');
emit('<path d="M980 418Q963 390 1005 358Q1044 380 1027 418Z" fill="#6f8579" stroke="#50665a" stroke-width="2.5"/>');
emit('</svg>');
if(entries.length===15&&highY>0)
  throw Error('Fifteen floors do not reach the image top: upper silhouette at y='+highY);
const output=new URL('visit/tower-still.svg',root);
await fs.writeFile(output,svg.join('\n')+'\n');
console.log('Real tower illustration: '+entries.length+' lower floors, '+totalRooms+
  ' room masses, '+totalBridges+' bridges, highest floor at y='+highY+
  ', base '+groundY+'px; source '+entries[0].date+' to '+entries.at(-1).date);
