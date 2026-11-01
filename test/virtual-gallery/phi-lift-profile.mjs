// Test tower only: collect stage timings, full frame-time distribution,
// and spikes during each lift journey without modifying its rendering.
export function createPhiLiftProfiler({enabled=false,now=()=>performance.now()}={}){
 if(!enabled)return null;
 const state={version:2,active:false,visits:[],current:null};
 let lastTick=0;
 const round=value=>+value.toFixed(1);
 const percentile=(xs,q)=>{
  if(!xs.length)return null;
  const sorted=[...xs].sort((a,b)=>a-b);
  return round(sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))]);
 };
 const longTaskObserver=typeof PerformanceObserver==='undefined'?null:new PerformanceObserver(list=>{
  const visit=state.active?state.current:null;
  if(!visit)return;
  for(const task of list.getEntries()){
   // Long-task callbacks may be delivered after the underlying task ended.
   if(task.startTime<visit.start)continue;
   visit.longTasks.push({elapsedMs:round(task.startTime-visit.start),durationMs:round(task.duration),
    stage:visit.stages.at(-1)?.name||'selection'});
   if(visit.longTasks.length>100)visit.longTasks.shift();
  }
 });
 try{longTaskObserver?.observe({entryTypes:['longtask']});}catch{longTaskObserver?.disconnect();}
 function begin(date,fromFloor,toFloor){
  if(state.active&&state.current)mark('interrupted');
  const at=now();
  const visit={date,fromFloor,toFloor,start:at,
   stages:[{name:'selection',at,elapsedMs:0}],frames:[],frameMs:[],longTasks:[],
   summary:null};
  state.visits.push(visit);
  if(state.visits.length>8)state.visits.shift();
  state.current=visit;state.active=true;lastTick=0;
 }
 function mark(name,details=null){
  const visit=state.current;if(!visit)return;
  const at=now();
  visit.stages.push({name,at,elapsedMs:round(at-visit.start),
   ...(details?{details}: {})});
 }
 function tick(){
  const at=now(),visit=state.active?state.current:null;
  // Do not attribute background-tab suspension to a rendering hitch.
  if(typeof document!=='undefined'&&document.hidden){lastTick=0;return;}
  if(visit&&lastTick){
   const delta=at-lastTick;
   if(delta>0){
    visit.frameMs.push(delta);
    if(delta>=50){
     visit.frames.push({elapsedMs:round(at-visit.start),deltaMs:round(delta),
      stage:visit.stages.at(-1)?.name||'selection'});
     if(visit.frames.length>200)visit.frames.shift();
    }
   }
  }
  lastTick=visit?at:0;
 }
 function finish(extra=null){
  if(!state.active||!state.current)return;
  mark('doors-opening',extra);
  const visit=state.current,ms=visit.frameMs;
  visit.summary={
   ms:round(now()-visit.start),
   frameCount:ms.length,
   frameP50Ms:percentile(ms,.5),
   frameP95Ms:percentile(ms,.95),
   frameP99Ms:percentile(ms,.99),
   largestFrameGapMs:round(Math.max(0,...ms)),
   framesOver33ms:ms.filter(x=>x>=33.3).length,
   framesOver50ms:ms.filter(x=>x>=50).length,
   framesOver80ms:ms.filter(x=>x>=80).length,
   framesOver100ms:ms.filter(x=>x>=100).length,
   framesOver250ms:ms.filter(x=>x>=250).length,
   // Retain existing diagnostic consumers while limiting exported size.
   frameSpikeStages:visit.frames.map(x=>({ms:x.deltaMs,stage:x.stage}))
  };
  state.active=false;lastTick=0;
 }
 return {state,begin,mark,tick,finish};
}
