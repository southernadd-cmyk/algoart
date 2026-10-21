// PROPORTION PIECE · virtual-gallery architecture v2.
// A spatial graph with branch points, loops and several routes, not a row of rooms.
// All coordinates are metres. Rendering is deliberately kept out of this module.
export const PHI = (1 + Math.sqrt(5)) / 2;
export const INV_PHI = 1 / PHI;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const DOOR_WIDTH = 3.8;
export const ROOM_HEIGHT = 5.2;
const CELL = 12.25;
const CORRIDOR_OVERLAP = 0.72;

export function seedFromString(value) {
  let h = 2166136261;
  for (const char of String(value)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let z = Math.imul(state ^ (state >>> 15), 1 | state);
    z ^= z + Math.imul(z ^ (z >>> 7), 61 | z);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

const PATTERNS = [
  // Four-room circuit; a cross-wing branches west and a vista leads north.
  [[0,0],[1,0],[1,-1],[0,-1],[0,-2],[-1,0],[-1,-1],[-2,-1],[-2,0],[1,-2],[2,-2],[2,-1],[2,0]],
  // Two linked circuits around a central group; the first four form a loop.
  [[0,0],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-2,0],[-2,-1],[-1,-2],[0,-2],[1,-2],[2,-2],[2,-1]],
  // Circuit with a lateral branch and a second, offset sequence.
  [[0,0],[0,-1],[1,-1],[1,0],[2,0],[0,1],[2,-1],[1,-2],[0,-2],[-1,-2],[-1,-1],[-1,0],[-2,0]]
];
function transformGrid(x,z,orientation,reflect) {
  if (reflect) x = -x;
  for (let i = 0; i < orientation; i++) [x,z] = [-z,x];
  return {x,z};
}
const directions = [
  {name:'east',dx:1,dz:0,reverse:'west'},
  {name:'west',dx:-1,dz:0,reverse:'east'},
  {name:'south',dx:0,dz:1,reverse:'north'},
  {name:'north',dx:0,dz:-1,reverse:'south'}
];

export function buildLayout(date, artworkCount, artworkStates = []) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid archive date');
  const count = Math.max(1,Math.floor(Number(artworkCount)||1));
  const signature = artworkStates.map(s => (s.seed||'')+':'+(s.engine||'')).join('|');
  const rand = makeRandom(seedFromString('PP-MUSEUM-PLAN-v2:'+date+':'+signature));
  const pattern = PATTERNS[Math.floor(rand()*PATTERNS.length)];
  const orientation = Math.floor(rand()*4);
  const reflect = rand() < .5;
  const roomCount = Math.ceil(count/3);
  const cells = pattern.map(([x,z])=>[x,z]);
  // Extend the tree at the perimeter if a future edition exceeds the current
  // archive sizes; new cells always share an edge with an existing one.
  for (let i=cells.length;i<roomCount;i++) {
    const existing = new Set(cells.map(p=>p.join(',')));
    const edge = cells.at(-1);
    const choices = [[1,0],[0,-1],[-1,0],[0,1]];
    let candidate=choices.map(([dx,dz])=>[edge[0]+dx,edge[1]+dz]).find(p=>!existing.has(p.join(',')));
    if (!candidate) {
      for (const c of cells) {
        candidate=choices.map(([dx,dz])=>[c[0]+dx,c[1]+dz]).find(p=>!existing.has(p.join(',')));
        if (candidate)break;
      }
    }
    cells.push(candidate);
  }
  const rooms=cells.slice(0,roomCount).map(([gx,gz],i)=>{
    const g=transformGrid(gx,gz,orientation,reflect);
    const engine=artworkStates[i*3]?.engine || 'field';
    const width=8.4 + rand()*.68 + (engine==='rects'?.30:0);
    const depth=8.45 + rand()*.75 + (engine==='organic'?.28:0);
    const distance=Math.abs(gx)+Math.abs(gz);
    const y= (distance%3)*.22;
    return {
      index:i,gx:g.x,gz:g.z,x:g.x*CELL,z:g.z*CELL,
      width,depth,y,system:engine,doors:[],neighbours:[],
      artStart:i*3,artEnd:Math.min(count,i*3+3),aspect:width/depth
    };
  });
  const byCell=new Map(rooms.map(r=>[r.gx+','+r.gz,r]));
  const corridors=[];
  for(const a of rooms){
    for(const d of directions){
      const b=byCell.get((a.gx+d.dx)+','+(a.gz+d.dz));
      if (!b || b.index<=a.index)continue;
      a.doors.push(d.name); b.doors.push(d.reverse);
      a.neighbours.push(b.index); b.neighbours.push(a.index);
      const onX=d.dx!==0, sign=onX?d.dx:d.dz;
      const from=onX ? a.x+sign*(a.width/2-CORRIDOR_OVERLAP) : a.z+sign*(a.depth/2-CORRIDOR_OVERLAP);
      const to=onX ? b.x-sign*(b.width/2-CORRIDOR_OVERLAP) : b.z-sign*(b.depth/2-CORRIDOR_OVERLAP);
      const start={x:onX?from:a.x,z:onX?a.z:from,y:a.y};
      const end={x:onX?to:b.x,z:onX?b.z:to,y:b.y};
      const length=Math.abs(to-from);
      corridors.push({a:a.index,b:b.index,from:d.name,to:d.reverse,
        axis:onX?'x':'z',start,end,length,halfWidth:DOOR_WIDTH/2});
    }
  }
  return {date,rooms,corridors,artworkCount:count,doorWidth:DOOR_WIDTH,pattern:PATTERNS.indexOf(pattern),orientation,reflect};
}

export function footprintAt(layout,x,z) {
  for (const room of layout.rooms) {
    if (Math.abs(x-room.x)<=room.width/2 && Math.abs(z-room.z)<=room.depth/2)
      return {x:room.x,z:room.z,y:room.y,room:room.index,zone:'room'};
  }
  for (const hall of layout.corridors) {
    const along=hall.axis==='x'?x:z;
    const cross=hall.axis==='x'?z:x;
    const start=hall.axis==='x'?hall.start.x:hall.start.z;
    const end=hall.axis==='x'?hall.end.x:hall.end.z;
    const centre=hall.axis==='x'?hall.start.z:hall.start.x;
    if(along>=Math.min(start,end)&&along<=Math.max(start,end)&&Math.abs(cross-centre)<=hall.halfWidth) {
      const t=(along-start)/(end-start);
      return {x,z,y:hall.start.y+(hall.end.y-hall.start.y)*t,room:null,zone:'corridor'};
    }
  }
  return null;
}
export function canStand(layout,x,z,padding=.42) {
  for (const room of layout.rooms) {
    if(Math.abs(x-room.x)<=room.width/2-padding && Math.abs(z-room.z)<=room.depth/2-padding)return true;
  }
  // Hallway overlap makes each doorway genuinely traversable, even with a
  // player's collision radius; it doesn't let them pass through the solid wall.
  for(const hall of layout.corridors){
    const along=hall.axis==='x'?x:z;
    const cross=hall.axis==='x'?z:x;
    const from=hall.axis==='x'?hall.start.x:hall.start.z;
    const to=hall.axis==='x'?hall.end.x:hall.end.z;
    const centre=hall.axis==='x'?hall.start.z:hall.start.x;
    if(along>=Math.min(from,to)&&along<=Math.max(from,to) && Math.abs(cross-centre)<=hall.halfWidth-padding)return true;
  }
  return false;
}
