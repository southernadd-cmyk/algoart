// Wall-clock presentation cadence, not GPU execution time or VRAM.
export function summarizeFrameTimes(samples){
 if(samples.length<10||samples.some(ms=>!Number.isFinite(ms)||ms<=0))throw Error('Insufficient valid rendered frames');
 const sorted=[...samples].sort((a,b)=>a-b);
 const percentile=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];
 const mean=samples.reduce((a,b)=>a+b,0)/samples.length;
 return {frames:samples.length,meanMs:mean,fps:1000/mean,medianMs:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),stalls50ms:samples.filter(ms=>ms>50).length};
}
export function pairedComparison(before,after,hybrid){
 const baselineMs=(before.meanMs+after.meanMs)/2;
 return {baselineFps:1000/baselineMs,frameTimeReductionPct:100*(baselineMs-hybrid.meanMs)/baselineMs,fpsGainPct:100*(baselineMs/hybrid.meanMs-1),baselineDriftPct:100*Math.abs(after.meanMs-before.meanMs)/before.meanMs};
}
export function benchmarkViewMatches(reference,current){
 return reference.date===current.date&&reference.width===current.width&&reference.height===current.height&&reference.pixelRatio===current.pixelRatio&&
 reference.position.every((x,i)=>Math.abs(x-current.position[i])<.015)&&
 Math.abs(reference.quaternion.reduce((sum,x,i)=>sum+x*current.quaternion[i],0))>.99999;
}
