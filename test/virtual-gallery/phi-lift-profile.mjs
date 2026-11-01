// Staging-only diagnostic. Marks the exact 3D lift stages and frame spikes
// without changing Three.js renderer, geometry, presentation or timings.
export function createPhiLiftProfiler({enabled=false,now=()=>performance.now()}={}){
 if(!enabled)return null;
 const state={version:1,active:false,visits:[],current:null};
 let lastTick=0;
 function begin(date,fromFloor,toFloor){
  const at=now();
  const visit={date,fromFloor,toFloor,start:at,
   stages:[{name:'selection',at,elapsedMs:0}],frames:[],longTasks:[],
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
  const at=now(),visit=state.current;
  if(visit&&lastTick){
   const delta=at-lastTick;
   if(delta>=80){
    visit.frames.push({at,elapsedMs:+(at-visit.start).toFixed(1),
     deltaMs:+delta.toFixed(1),stage:visit.stages.at(-1)?.name});
    if(visit.frames.length>120)visit.frames.shift();
   }
  }
  if(visit)lastTick=at;
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
 return {state,begin,mark,tick,finish};
}
