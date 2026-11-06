// TEST BRANCH ONLY: non-invasive measurements to investigate the 6-second
// paintings-waiting frame gap. Activated exclusively by ?liftpainttrace=1.
// Measurements are observational; no artwork/lift scheduling behaviour changes.
export function createPhiPaintingTrace({enabled=false,now=()=>performance.now()}={}){
 if(!enabled)return null;
 const events=[],longTasks=[],longAnimationFrames=[];
 const observedLoAF=!!globalThis.PerformanceObserver?.supportedEntryTypes?.includes('long-animation-frame');
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
 if(observedLoAF){
  try{
   const observer=new PerformanceObserver(list=>{
    for(const frame of list.getEntries()){
     longAnimationFrames.push({
      start:frame.startTime,end:frame.startTime+frame.duration,
      ms:+frame.duration.toFixed(1),
      blockingMs:+(frame.blockingDuration||0).toFixed(1),
      scripts:(frame.scripts||[]).sort((a,b)=>b.duration-a.duration).slice(0,5).map(x=>({
       at:x.executionStart,ms:+x.duration.toFixed(1),
       invoker:x.invoker||'',function:x.sourceFunctionName||'',
       source:x.sourceURL?.split('/').pop()?.slice(0,95)||''
      }))
     });
    }
    if(longAnimationFrames.length>110)longAnimationFrames.splice(0,longAnimationFrames.length-110);
   });
   observer.observe({type:'long-animation-frame',buffered:true});
  }catch{}
 }
 const event=(name,details={})=>{
  const at=now();
  events.push({name,at,date:details.date||date,
   ...details, ...(Number.isFinite(details.ms)?{ms:+details.ms.toFixed(1)}:{})});
  if(events.length>800)events.splice(0,events.length-800);
 };
 const measure=(name,call)=>{
  const started=now();
  try{return call();}finally{
   const duration=now()-started;
   if(duration>=30)event(name,{ms:duration});
  }
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
   longAnimationFrames:longAnimationFrames.filter(f=>f.start<=end&&f.end>=started)
    .sort((a,b)=>b.ms-a.ms).slice(0,6).map(f=>({
     atMs:+(f.start-started).toFixed(1),ms:f.ms,blockingMs:f.blockingMs,
     scripts:f.scripts.map(x=>({...x,atMs:+(x.at-started).toFixed(1),at:undefined}))
    })),
   longAnimationFrameAPI:observedLoAF,
   slowImageResources:resources
  };
 };
 const trace={begin,event,measure,report};
 globalThis.__phiPaintingTrace=trace;
 return trace;
}
