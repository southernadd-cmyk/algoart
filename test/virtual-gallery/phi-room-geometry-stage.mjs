// Test-only destination room geometry staging. Build the exact BoxGeometry
// objects the existing block() path would allocate, but during lift travel.
// No shared geometry or mesh/material changes: each staged object is claimed
// once, and unused work is disposed on a changed/cancelled destination.
export function createPhiRoomGeometryStager({create,schedule,dispose}){
 if(typeof create!=='function'||typeof schedule!=='function'||typeof dispose!=='function')
  throw new TypeError('Room geometry stage requires create, schedule and dispose');
 let current=null;
 const key=(w,h,d)=>[w,h,d].join('|');
 const clear=()=>{
  const old=current;current=null;
  if(!old)return;
  old.cancelled=true;old.queue.length=0;
  for(const geometries of old.ready.values())for(const geometry of geometries)dispose(geometry);
  old.ready.clear();
 };
 const start=(date,shapes)=>{
  clear();
  const queue=(shapes||[]).filter(s=>Array.isArray(s)&&s.length===3&&
   s.every(n=>Number.isFinite(n)&&n>0));
  const session={date,queue,ready:new Map(),created:0,used:0,failed:0,cancelled:false};
  current=session;
  const step=()=>{
   if(session.cancelled||session!==current)return;
   const dimensions=session.queue.shift();
   if(!dimensions)return;
   try{
    const geometry=create(...dimensions);
    const id=key(...dimensions);
    if(!session.ready.has(id))session.ready.set(id,[]);
    session.ready.get(id).push(geometry);
    session.created++;
   }catch(error){
    session.failed++;
    console.warn('Destination room geometry preparation skipped',error);
   }
   if(session.queue.length)schedule(step);
  };
  if(queue.length)schedule(step);
 };
 const take=(date,w,h,d)=>{
  if(current?.date!==date)return null;
  const available=current.ready.get(key(w,h,d));
  if(!available?.length)return null;
  current.used++;
  return available.pop();
 };
 const stats=()=>current?{
  date:current.date,created:current.created,used:current.used,
  pending:current.queue.length,
  ready:[...current.ready.values()].reduce((sum,array)=>sum+array.length,0),
  failed:current.failed
 }:{date:null,created:0,used:0,pending:0,ready:0,failed:0};
 return {start,take,clear,stats};
}
