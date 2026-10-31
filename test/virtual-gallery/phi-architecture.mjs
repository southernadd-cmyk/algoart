// Phase A: deterministic golden-subdivision architecture study.
// Pure geometry, intentionally not wired into the production tower.
export const PHI=(1+Math.sqrt(5))/2;
export const INV_PHI=1/PHI;
function hash(s){let h=2166136261;for(const c of s){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
function rng(seed){let a=hash(seed);return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
export function planPhiFloor(date,{artworks=18,span=null,minSide=null,variation=0}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Expected YYYY-MM-DD');
 // Exhibition-scale footprint: a typical 18-piece floor occupies roughly 30 × 19 m.
 // The art count, rather than a fixed monumental footprint, controls the scale.
 span=span??Math.max(15,Math.min(31,19*Math.sqrt(Math.max(1,artworks)/18)));
 minSide=minSide??Math.max(2.65,span*.155);
 const random=rng('phi-architecture-v1|'+date+'|'+artworks+'|'+variation);
 const root={x:-span*PHI/2,z:-span/2,w:span*PHI,h:span,depth:0,id:'root'};
 const leaves=[root],splits=[];
 // Recursive golden section cuts: the cut location is always 1/phi of the long axis.
 for(let step=0;step<96;step++){
  const possible=leaves.filter(r=>Math.max(r.w,r.h)>=2*minSide&&Math.min(r.w,r.h)>=minSide);
  if(!possible.length||leaves.length>=Math.max(8,Math.ceil(artworks/2)+2))break;
  const sorted=possible.map(r=>({r,weight:r.w*r.h*(.72+random()*.56)})).sort((a,b)=>b.weight-a.weight);
  const parent=sorted[Math.floor(random()*Math.min(3,sorted.length))].r;
  const vertical=parent.w>=parent.h;
  const long=vertical?parent.w:parent.h;
  const cut=long*INV_PHI;
  const a={...parent,id:parent.id+'a',depth:parent.depth+1};
  const b={...parent,id:parent.id+'b',depth:parent.depth+1};
  if(vertical){a.w=cut;b.w=long-cut;b.x=parent.x+cut;}
  else{a.h=cut;b.h=long-cut;b.z=parent.z+cut;}
  const idx=leaves.indexOf(parent);leaves.splice(idx,1,a,b);
  splits.push({parent:parent.id,axis:vertical?'x':'z',at:vertical?parent.x+cut:parent.z+cut,ratio:PHI});
 }
 // Rooms are the useful larger leaves; smaller cells become voids or circulation.
 const classified=leaves.map((r,i)=>({...r,role:Math.min(r.w,r.h)<minSide||r.w*r.h<minSide*minSide*1.55?'void':'gallery',area:r.w*r.h}));
 const galleries=classified.filter(r=>r.role==='gallery');
 if(!galleries.length)throw Error('No gallery cells generated');
 // Merge adjacent golden cells into usable exhibition rooms. The cells remain
 // untouched mathematically; only internal partitions are removed.
 // Compact rooms are favoured, but L-shaped unions are permitted.
 const targetRooms=Math.min(classified.length,Math.max(2,Math.ceil(artworks/4.5)));
 const groups=classified.map((cell,i)=>({id:i,cells:[cell],area:cell.area}));
 const commonEdge=(a,b)=>{
  const ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
  const oz=Math.min(a.z+a.h,b.z+b.h)-Math.max(a.z,b.z);
  return Math.abs(ox)<1e-6&&oz>1?oz:Math.abs(oz)<1e-6&&ox>1?ox:0;
 };
 while(groups.length>targetRooms){
  let best=null;
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
   const a=groups[i],b=groups[j];
   let shared=0;
   for(const x of a.cells)for(const y of b.cells)shared+=commonEdge(x,y);
   if(!shared)continue;
   const combined=a.cells.concat(b.cells),minX=Math.min(...combined.map(x=>x.x));
   const maxX=Math.max(...combined.map(x=>x.x+x.w));
   const minZ=Math.min(...combined.map(x=>x.z));
   const maxZ=Math.max(...combined.map(x=>x.z+x.h));
   const boundsArea=(maxX-minX)*(maxZ-minZ);
   const fill=(a.area+b.area)/boundsArea;
   const score=fill*5+shared*.10-Math.abs(a.area-b.area)/(a.area+b.area)*.5+random()*.025;
   if(!best||score>best.score)best={i,j,score};
  }
  if(!best)break;
  const a=groups[best.i],b=groups[best.j];
  a.cells.push(...b.cells);a.area+=b.area;
  groups.splice(best.j,1);
 }
 const mergedRooms=groups.map((group,i)=>({
  id:'gallery-'+(i+1),area:group.area,
  cells:group.cells.map(cell=>cell.id),
  pieces:group.cells.map(({x,z,w,h,id})=>({x,z,w,h,id})),
  x:Math.min(...group.cells.map(x=>x.x)),
  z:Math.min(...group.cells.map(x=>x.z)),
  width:Math.max(...group.cells.map(x=>x.x+x.w))-Math.min(...group.cells.map(x=>x.x)),
  depth:Math.max(...group.cells.map(x=>x.z+x.h))-Math.min(...group.cells.map(x=>x.z))
 }));
 // A spanning-tree adjacency guide; actual door/corridor planning is Phase B.
 const contacts=[];
 for(let i=0;i<classified.length;i++)for(let j=i+1;j<classified.length;j++){
  const a=classified[i],b=classified[j];
  const ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
  const oz=Math.min(a.z+a.h,b.z+b.h)-Math.max(a.z,b.z);
  if((Math.abs(ox)<1e-6&&oz>1)||(Math.abs(oz)<1e-6&&ox>1))contacts.push({a:a.id,b:b.id,shared:Math.max(ox,oz)});
 }
 return {version:3,date,mergedRooms,seed:hash('phi-architecture-v1|'+date+'|'+artworks+'|'+variation),phi:PHI,root,rooms:classified,splits,contacts,stats:{galleryCells:galleries.length,voidCells:classified.length-galleries.length,totalCells:classified.length,mergedCount:mergedRooms.length,targetRooms,contacts:contacts.length,footprintArea:root.w*root.h}};
}
