// Test-only ?gpuprofile=1. Non-blocking GPU timing; no changes to rendered pixels.
const summary=values=>{
 if(!values.length)return null;
 const a=[...values].sort((x,y)=>x-y),p=n=>a[Math.floor((a.length-1)*n)];
 return {count:a.length,median:+p(.5).toFixed(2),p95:+p(.95).toFixed(2),max:+a.at(-1).toFixed(2)};
};
export function createPhiGpuProfiler(renderer,{enabled=false,now=()=>performance.now()}={}){
 if(!enabled||!renderer)return null;
 const gl=renderer.getContext(),ext=gl.getExtension?.('EXT_disjoint_timer_query_webgl2');
 const supported=!!ext&&typeof gl.createQuery==='function';
 const pending=[],samples=[];
 let frame=0,active=null,errors=0,disjointCount=0;
 function poll(){
  if(!supported)return;
  try{
   const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
   while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
    const item=pending.shift();
    if(!disjoint)item.sample.gpuMs=+(gl.getQueryParameter(item.query,gl.QUERY_RESULT)/1e6).toFixed(3);
    else disjointCount++;
    gl.deleteQuery(item.query);
   }
  }catch{errors++;}
 }
 function begin(){
  if(active)return;
  poll();
  if(++frame%3!==0)return;
  const sample={cpuMs:null,gpuMs:null,drawCalls:null,triangles:null,stage:globalThis.__phiLiftRide?.status||'gallery'};
  active={sample,start:now(),query:null};
  if(supported&&pending.length<6)try{
   const query=gl.createQuery();
   if(query){gl.beginQuery(ext.TIME_ELAPSED_EXT,query);active.query=query;}
  }catch{errors++;}
 }
 function end(){
  if(!active)return;
  const item=active;active=null;
  if(item.query)try{gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(item);}
   catch{errors++;gl.deleteQuery(item.query);}
  item.sample.cpuMs=+(now()-item.start).toFixed(3);
  item.sample.drawCalls=renderer.info?.render?.calls??null;
  item.sample.triangles=renderer.info?.render?.triangles??null;
  samples.push(item.sample);
  if(samples.length>120)samples.shift();
 }
 function snapshot(){
  poll();
  return {version:1,mode:'test-only',supported,frames:frame,samples:samples.length,
   pending:pending.length,disjoint:disjointCount,errors,
   cpuMs:summary(samples.map(s=>s.cpuMs).filter(Number.isFinite)),
   gpuMs:summary(samples.map(s=>s.gpuMs).filter(Number.isFinite)),
   drawCalls:summary(samples.map(s=>s.drawCalls).filter(Number.isFinite)),
   triangles:summary(samples.map(s=>s.triangles).filter(Number.isFinite)),
   recent:samples.slice(-8)};
 }
 function reset(){
  for(const item of pending.splice(0))gl.deleteQuery(item.query);
  samples.length=0;frame=0;errors=0;disjointCount=0;
 }
 return {supported,begin,end,poll,snapshot,reset};
}
