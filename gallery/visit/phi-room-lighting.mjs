// Approved golden-division room lighting, shared with the test comparison.
export const PHI=(1+Math.sqrt(5))/2;
export function planPhiRoomLighting(entries,toWorld=(x,z)=>({x,z})){
 const ranked=entries.map((entry,index)=>({entry,index})).sort((a,b)=>b.entry.cell.w*b.entry.cell.h-a.entry.cell.w*a.entry.cell.h||a.index-b.index);
 const primary=new Set(ranked.slice(0,Math.ceil(entries.length/2)).map(row=>row.index));
 const weights=entries.map((_,i)=>primary.has(i)?PHI:1);
 const total=entries.reduce((sum,entry)=>sum+entry.power,0);
 const scale=total/(weights.reduce((sum,w)=>sum+w,0)||1);
 return entries.map((entry,i)=>{
  const {cell}=entry;
  const fx=i%2?1/PHI:1-1/PHI, fz=1-fx;
  const point=toWorld(cell.x+cell.w*fx,cell.z+cell.h*fz);
  return {x:point.x,z:point.z,power:weights[i]*scale,primary:primary.has(i)};
 });
}
// Apply after the active floor has been rotated into world coordinates.
// Reuse existing lights, targets and fixtures; no extra rendering passes.
export function applyPhiRoomLighting(entries,world){
 const variants=planPhiRoomLighting(entries,world?.toWorld);
 entries.forEach((entry,i)=>{
  const variant=variants[i];
  const dx=variant.x-entry.light.position.x,dz=variant.z-entry.light.position.z;
  for(const object of [entry.light,entry.light.target,entry.mount,entry.fallback]){
   object.position.x+=dx;object.position.z+=dz;object.updateMatrixWorld(true);
  }
  entry.light.intensity=variant.power;
 });
 return variants;
}
