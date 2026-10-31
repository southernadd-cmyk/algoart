// Prepare individual sculptures during a lift ride without placing them in
// the visible scene. One setup per animation frame avoids a construction burst.
// The caller owns disposal of unused pivots and attachment of claimed pivots.
export function createPhiSculptureStager({schedule,create,dispose}){
 if(typeof schedule!=='function'||typeof create!=='function'||typeof dispose!=='function')
  throw new TypeError('Sculpture staging requires schedule, create and dispose callbacks');
 let active=null;
 const clear=()=>{
  const session=active;
  if(!session)return;
  active=null;
  session.cancelled=true;
  session.queue.length=0;
  for(const staged of session.ready.values())dispose(staged);
  session.ready.clear();
 };
 const start=(date,entries)=>{
  clear();
  const queue=[],seen=new Set();
  for(const entry of entries){
   if(!entry||seen.has(entry.id))continue;
   seen.add(entry.id);queue.push(entry);
  }
  const session={date,queue,ready:new Map(),cancelled:false,created:0,failed:0};
  active=session;
  const next=()=>{
   if(session.cancelled||active!==session)return;
   const entry=session.queue.shift();
   if(!entry)return;
   try{
    const built=create(entry);
    if(built){session.ready.set(entry.id,built);session.created++;}
    else session.failed++;
   }catch(error){
    session.failed++;
    // The destination's ordinary deferred loader remains the fallback.
    console.warn('Sculpture could not be staged',entry.id,error);
   }
   if(session.queue.length)schedule(next);
  };
  if(queue.length)schedule(next);
 };
 const take=(date,id)=>{
  if(active?.date!==date)return null;
  const built=active.ready.get(id)||null;
  if(built)active.ready.delete(id);
  return built;
 };
 const stats=()=>active?{
  date:active.date,queued:active.queue.length,ready:active.ready.size,
  created:active.created,failed:active.failed
 }:{date:null,queued:0,ready:0,created:0,failed:0};
 return {start,take,clear,stats};
}
