// Staging-only diagnostic. Marks the exact 3D lift stages and frame spikes
// without changing Three.js renderer, geometry, presentation or timings.
export function createPhiLiftProfiler({enabled=false,now=()=>performance.now()}={}){
 if(!enabled)return null;
 const state={version:1,active:false,visits:[],current:null};
 let lastTick=0;
 function begin(date,fromFloor,toFloor){
  const at=now();
  const visit={date,fromFloor,toFloor,start:at,
   stages:[{name:'selection',at,elapsedMs:0}],frames:[],longTasks:[],operations:{},operationSpikes:[],
   summary:null};
  state.visits.push(visit);if(state.visits.length>8)state.visits.shift();
  state.current=visit;state.active=true;lastTick=0;
 }
 function mark(name,details=null){
  const visit=state.current;if(!visit)return;
  const at=now();
  visit.stages.push({name,at,elapsedMs:+(at-visit.start).toFixed(1),
   ...(details?{details}: {})});
 }
 function tick(){
  // After door release, keep the finished visit immutable. Previously this
  // recorded post-visit spikes under 'doors-opening' indefinitely and could
  // make the journey appear much longer than it actually was.
  if(!state.active||!state.current)return;
  const at=now(),visit=state.current;
  if(lastTick){
   const delta=at-lastTick;
   if(delta>=80){
    visit.frames.push({at,elapsedMs:+(at-visit.start).toFixed(1),
     deltaMs:+delta.toFixed(1),stage:visit.stages.at(-1)?.name});
    if(visit.frames.length>120)visit.frames.shift();
   }
  }
  if(visit)lastTick=at;
 }
 // Measure CPU-side work inside the update loop. The existing frame-gap
 // recorder also catches asynchronous GPU and browser/compositor stalls.
 // Keep only aggregates and the 20 worst spikes to bound memory.
 function record(name,ms){
  if(!state.active||!state.current||!Number.isFinite(ms)||ms<0)return;
  const visit=state.current;
  const entry=visit.operations[name]??={count:0,totalMs:0,maxMs:0,over16ms:0,over50ms:0};
  entry.count++;
  entry.totalMs=+(entry.totalMs+ms).toFixed(1);
  entry.maxMs=Math.max(entry.maxMs,+ms.toFixed(1));
  if(ms>=16)entry.over16ms++;
  if(ms>=50)entry.over50ms++;
  if(ms>=40){
   visit.operationSpikes.push({name,ms:+ms.toFixed(1),stage:visit.stages.at(-1)?.name});
   visit.operationSpikes.sort((a,b)=>b.ms-a.ms);
   if(visit.operationSpikes.length>20)visit.operationSpikes.length=20;
  }
 }
 function finish(extra=null){
  if(!state.current)return;
  mark('doors-opening',extra);
  const visit=state.current;
  visit.summary={ms:+(now()-visit.start).toFixed(1),
   largestFrameGapMs:Math.max(0,...visit.frames.map(x=>x.deltaMs)),
   framesOver100ms:visit.frames.filter(x=>x.deltaMs>=100).length,
   frameSpikeStages:visit.frames.map(x=>({ms:x.deltaMs,stage:x.stage}))};
  state.active=false;lastTick=0;
 }
 return {state,begin,mark,tick,record,finish};
}
