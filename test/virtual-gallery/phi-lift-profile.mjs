// TEST tower only. Measure exact sync operations and correlate with rAF gaps.
// "last stage" is context, not necessarily the cause of a frame spike.
export function createPhiLiftProfiler({enabled=false,now=()=>performance.now()}={}){
 if(!enabled)return null;
 const state={version:3,active:false,visits:[],current:null};
 let lastTick=0;
 const round=value=>+value.toFixed(1);
 const percentile=(xs,q)=>{
  if(!xs.length)return null;
  const sorted=[...xs].sort((a,b)=>a-b);
  return round(sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))]);
 };
 const observer=typeof PerformanceObserver==='undefined'?null:new PerformanceObserver(list=>{
  const v=state.active?state.current:null;
  if(!v)return;
  for(const task of list.getEntries()){
   if(task.startTime<v.start)continue;
   v.longTasks.push({elapsedMs:round(task.startTime-v.start),durationMs:round(task.duration),
    stage:v.stages.at(-1)?.name||'selection'});
   if(v.longTasks.length>130)v.longTasks.shift();
  }
 });
 try{observer?.observe({entryTypes:['longtask']});}catch{observer?.disconnect();}
 // Chromium's Long Animation Frames API reports the JS source functions
 // responsible for blocking long frames when script attribution is available.
 // It won't identify every GPU/compositor stall; those remain "unattributed".
 const loafObserver=typeof PerformanceObserver==='undefined'?null:new PerformanceObserver(list=>{
  const v=state.active?state.current:null;
  if(!v)return;
  for(const frame of list.getEntries()){
   if(frame.startTime<v.start)continue;
   const scripts=[...(frame.scripts||[])].sort((a,b)=>b.duration-a.duration).slice(0,8)
    .map(script=>({
     functionName:script.sourceFunctionName||null,
     sourcePath:typeof script.sourceURL==='string'?script.sourceURL.split('?')[0]:null,
     durationMs:round(script.duration||0),
     executionStartMs:round((script.executionStart??frame.startTime)-v.start),
     invoker:script.invoker||null
    }));
   v.longAnimationFrames.push({
    elapsedMs:round(frame.startTime-v.start),durationMs:round(frame.duration),
    blockingDurationMs:round(frame.blockingDuration||0),scripts
   });
   if(v.longAnimationFrames.length>100)v.longAnimationFrames.shift();
  }
 });
 try{
  if(PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame'))
   loafObserver?.observe({type:'long-animation-frame',buffered:false});
 }catch{loafObserver?.disconnect();}
 function begin(date,fromFloor,toFloor){
  if(state.active&&state.current){
   mark('interrupted');state.current.interrupted=true;
  }
  const at=now();
  const visit={date,fromFloor,toFloor,start:at,
   stages:[{name:'selection',at,elapsedMs:0}],frames:[],frameMs:[],
   longTasks:[],longAnimationFrames:[],operations:[],operationTotals:{},summary:null};
  state.visits.push(visit);if(state.visits.length>8)state.visits.shift();
  state.current=visit;state.active=true;lastTick=0;
 }
 function mark(name,details=null){
  const visit=state.current;if(!visit)return;
  const at=now();
  visit.stages.push({name,at,elapsedMs:round(at-visit.start),
   ...(details?{details}:{})});
 }
 function recordOperation(name,start,duration,details=null){
  const v=state.active?state.current:null;
  if(!v||!Number.isFinite(duration)||duration<0||start<v.start)return;
  const total=v.operationTotals[name]??={count:0,totalMs:0,maxMs:0};
  total.count++;total.totalMs+=duration;total.maxMs=Math.max(total.maxMs,duration);
  // Keeping only expensive operations avoids enormous JSONs during long trips.
  if(duration>=6){
   v.operations.push({name,elapsedMs:round(start-v.start),durationMs:round(duration),
    ...(details?{details}: {})});
   if(v.operations.length>350)v.operations.shift();
  }
 }
 function measure(name,fn,details=null){
  if(!state.active)return fn();
  const start=now();
  try{return fn();}
  finally{recordOperation(name,start,now()-start,details);}
 }
 function tick(){
  const at=now(),v=state.active?state.current:null;
  if(typeof document!=='undefined'&&document.hidden){lastTick=0;return;}
  if(v&&lastTick){
   const d=at-lastTick;
   if(d>0){
    v.frameMs.push(d);
    if(d>=50){
     v.frames.push({elapsedMs:round(at-v.start),deltaMs:round(d),
      stage:v.stages.at(-1)?.name||'selection'});
     if(v.frames.length>200)v.frames.shift();
    }
   }
  }
  lastTick=v?at:0;
 }
 function finish(extra=null){
  if(!state.active||!state.current)return;
  mark(state.current.stages.some(s=>s.name==='failure')?'finished-after-error':'doors-fully-open',extra);
  const v=state.current,ms=v.frameMs;
  const totals={};
  for(const [name,entry] of Object.entries(v.operationTotals))
   totals[name]={count:entry.count,totalMs:round(entry.totalMs),maxMs:round(entry.maxMs)};
  v.summary={
   ms:round(now()-v.start),frameCount:ms.length,
   frameP50Ms:percentile(ms,.5),frameP95Ms:percentile(ms,.95),
   frameP99Ms:percentile(ms,.99),
   largestFrameGapMs:round(Math.max(0,...ms)),
   framesOver33ms:ms.filter(x=>x>=33.3).length,
   framesOver50ms:ms.filter(x=>x>=50).length,
   framesOver80ms:ms.filter(x=>x>=80).length,
   framesOver100ms:ms.filter(x=>x>=100).length,
   framesOver250ms:ms.filter(x=>x>=250).length,
   operationTotals:totals,
   frameSpikeStages:v.frames.map(x=>({ms:x.deltaMs,stage:x.stage}))
  };
  state.active=false;lastTick=0;
 }
 return {state,begin,mark,tick,finish,measure,recordOperation};
}
