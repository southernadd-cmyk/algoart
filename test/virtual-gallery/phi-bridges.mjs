import {planPhiCirculation} from './phi-circulation.mjs';
// Phase C: carve selected golden cells into open courts and bridge across them.
// Returns a derived floor; the original deterministic subdivision stays intact.
export function planPhiBridges(plan,{maxBridges=3}={}){
 const owners=new Map(plan.mergedRooms.flatMap((r,i)=>r.cells.map(id=>[id,i])));
 const cells=plan.rooms;
 const overlap=(a,b,c,d)=>Math.min(b,d)-Math.max(a,c);
 const touch=(a,b)=> {
  const z=overlap(a.z,a.z+a.h,b.z,b.z+b.h),x=overlap(a.x,a.x+a.w,b.x,b.x+b.w);
  return (Math.abs(a.x+a.w-b.x)<1e-5||Math.abs(b.x+b.w-a.x)<1e-5)&&z>2.8 ||
    (Math.abs(a.z+a.h-b.z)<1e-5||Math.abs(b.z+b.h-a.z)<1e-5)&&x>2.8;
 };
 const options=[];
 for(const v of cells){
  const group=owners.get(v.id),remaining=plan.mergedRooms[group].pieces.filter(c=>c.id!==v.id);
  if(!remaining.length)continue;
  // Removing a golden cell must not fragment its original merged room.
  const seen=new Set([remaining[0].id]),pending=[remaining[0]];
  while(pending.length){const a=pending.shift();for(const b of remaining)if(!seen.has(b.id)&&touch(a,b)){seen.add(b.id);pending.push(b);}}
  if(seen.size!==remaining.length)continue;
  for(const axis of ['x','z']){
   const before=cells.filter(a=>a.id!==v.id&&(axis==='x'?Math.abs(a.x+a.w-v.x)<1e-5:Math.abs(a.z+a.h-v.z)<1e-5));
   const after=cells.filter(a=>a.id!==v.id&&(axis==='x'?Math.abs(a.x-v.x-v.w)<1e-5:Math.abs(a.z-v.z-v.h)<1e-5));
   for(const a of before)for(const b of after){
    if(a.id===b.id||owners.get(a.id)===owners.get(b.id))continue;
    const perpendicular=axis==='x'?'z':'x',length=axis==='x'?v.w:v.h;
    const low=Math.max(v[perpendicular],a[perpendicular],b[perpendicular]);
    const high=Math.min(v[perpendicular]+(axis==='x'?v.h:v.w),a[perpendicular]+(axis==='x'?a.h:a.w),b[perpendicular]+(axis==='x'?b.h:b.w));
    if(high-low<2.8||length<2.5||length>18)continue;
    const width=Math.min(2.5,high-low-.3),centre=low+(high-low)*.61803398875;
    if(centre-width/2<low+.15||centre+width/2>high-.15)continue;
    options.push({voidCell:v.id,fromCell:a.id,toCell:b.id,fromRoom:owners.get(a.id),toRoom:owners.get(b.id),axis,width,centre,
      from:axis==='x'?v.x:v.z,to:axis==='x'?v.x+v.w:v.z+v.h,length,score:length*.3+high-low});
   }
  }
 }
 options.sort((a,b)=>b.score-a.score||a.voidCell.localeCompare(b.voidCell));
 const picked=[],reserved=new Set(),usedRooms=new Set();
 for(const option of options){
  if(picked.length>=maxBridges)break;
  const owner=owners.get(option.voidCell);
  if(usedRooms.has(owner)||reserved.has(option.voidCell)||reserved.has(option.fromCell)||reserved.has(option.toCell))continue;
  const v=cells.find(c=>c.id===option.voidCell);
  const liftX=plan.root.x+2.2,liftZ=plan.root.z+2.2;
  if(liftX>=v.x&&liftX<=v.x+v.w&&liftZ>=v.z&&liftZ<=v.z+v.h)continue;
  picked.push({...option,id:'bridge-'+(picked.length+1)});usedRooms.add(owner);
  reserved.add(option.voidCell);reserved.add(option.fromCell);reserved.add(option.toCell);
 }
 // Ensure removing a void never destroys the conventional doorway network.
 // Keep the bridges as an optional loop, not the only route to a room.
 function derived(selected){
  const voidIds=new Set(selected.map(b=>b.voidCell));
  const rooms=plan.mergedRooms.map(r=>{
   const pieces=r.pieces.filter(p=>!voidIds.has(p.id)),area=pieces.reduce((sum,p)=>sum+p.w*p.h,0);
   if(!pieces.length)return null;
   return {...r,pieces,cells:pieces.map(p=>p.id),area,
    x:Math.min(...pieces.map(p=>p.x)),z:Math.min(...pieces.map(p=>p.z)),
    width:Math.max(...pieces.map(p=>p.x+p.w))-Math.min(...pieces.map(p=>p.x)),
    depth:Math.max(...pieces.map(p=>p.z+p.h))-Math.min(...pieces.map(p=>p.z))};
  });
  if(rooms.some(r=>!r))return null;
  return {...plan,mergedRooms:rooms,rooms:cells.filter(c=>!voidIds.has(c.id))};
 }
 while(picked.length){
  const candidate=derived(picked);
  if(candidate&&planPhiCirculation(candidate).connected)break;
  picked.pop();
 }
 const derivedPlan=derived(picked)||plan;
 const voidIds=new Set(picked.map(b=>b.voidCell));
 return {plan:derivedPlan,bridges:picked,voids:cells.filter(c=>voidIds.has(c.id)),candidateCount:options.length};
}
