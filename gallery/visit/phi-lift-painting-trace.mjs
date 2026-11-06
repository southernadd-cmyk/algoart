// TEST BRANCH ONLY: non-invasive measurements to investigate the 6-second
// paintings-waiting frame gap. Activated exclusively by ?liftpainttrace=1.
// Measurements are observational; no artwork/lift scheduling behaviour changes.
export function createPhiPaintingTrace({enabled=false,now=()=>performance.now()}={}){
 if(!enabled)return null;
 const events=[],longTasks=[];
 let date=null;
 try{performance.setResourceTimingBufferSize?.(2000);}catch{}
 if(globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')){
  try{
   const observer=new PerformanceObserver(list=>{
    for(const entry of list.getEntries())longTasks.push({
     start:entry.startTime,end:entry.startTime+entry.duration,
     ms:+entry.duration.toFixed(1),name:entry.name
    });
    if(longTasks.length>350)longTasks.splice(0,longTasks.length-350);
   });
   observer.observe({type:'longtask',buffered:true});
  }catch{}
 }
 const event=(name,details={})=>{
  const at=now();
  events.push({name,at,date:details.date||date,
   ...details, ...(Number.isFinite(details.ms)?{ms:+details.ms.toFixed(1)}:{})});
  if(events.length>800)events.splice(0,events.length-800);
 };
 const begin=nextDate=>{date=nextDate;event('lift-prepare-start',{date});};
 const report=(rideDate,started,elapsed)=>{
  const end=started+elapsed;
  const related=events.filter(e=>e.date===rideDate&&e.at>=started&&e.at<=end);
  const timings=related.filter(e=>Number.isFinite(e.ms));
  const byName={};
  for(const e of timings){
   const item=byName[e.name]??={count:0,totalMs:0,maxMs:0};
   item.count++;item.totalMs+=e.ms;item.maxMs=Math.max(item.maxMs,e.ms);
  }
  for(const value of Object.values(byName))value.totalMs=+value.totalMs.toFixed(1);
  const snapshot=e=>({
   name:e.name,atMs:+(e.at-started).toFixed(1),
   ...(Number.isFinite(e.ms)?{ms:e.ms}:{}),
   ...(e.id?{id:e.id}:{}),...(e.url?{asset:e.url.split('/').pop().slice(0,75)}:{}),
   ...(e.expected!==undefined?{expected:e.expected,ready:e.ready,pending:e.pending}:{}),
   ...(e.loaded!==undefined?{loaded:e.loaded}:{}),
   ...(e.total!==undefined?{total:e.total}:{}),
   ...(e.preload?{preload:e.preload}:{}),
   ...(e.gpu?{gpu:e.gpu}:{}),
  });
  const tasks=longTasks.filter(t=>t.start<=end&&t.end>=started)
   .sort((a,b)=>b.ms-a.ms).slice(0,8).map(t=>({
    atMs:+(t.start-started).toFixed(1),ms:t.ms,name:t.name
   }));
  let resources=[];
  try{
   resources=performance.getEntriesByType('resource')
    .filter(r=>r.startTime>=started&&r.startTime<=end&&
     /\.(jpe?g|png|webp)(\?|$)/i.test(r.name))
    .sort((a,b)=>b.duration-a.duration).slice(0,8).map(r=>({
     asset:r.name.split('/').pop().slice(0,75),
     atMs:+(r.startTime-started).toFixed(1),
     durationMs:+r.duration.toFixed(1),
     transferSize:r.transferSize,
     decodedBodySize:r.decodedBodySize
    }));
  }catch{}
  return {
   eventsRecorded:related.length,
   byName,
   checkpoints:related.filter(e=>e.name==='paintings-wait-start'||e.name==='paintings-wait-end').map(snapshot),
   slowEvents:[...timings].sort((a,b)=>b.ms-a.ms).slice(0,10).map(snapshot),
   longTasks:tasks,
   slowImageResources:resources
  };
 };
 const trace={begin,event,report};
 globalThis.__phiPaintingTrace=trace;
 return trace;
}
