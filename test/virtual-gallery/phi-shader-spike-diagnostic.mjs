// TEST TOWER ONLY. Opt in with ?shadertrace=1.
// Attribute unusually slow shader-program queries without changing shaders,
// Three.js renderer state, draw order or return values. This module loads
// BEFORE the gallery bundle so it can capture program creation/link metadata.
// No work is installed during ordinary test visits or in the live gallery.
const enabled=new URLSearchParams(location.search).get('shadertrace')==='1';
if(enabled){
 const programData=new WeakMap(),shaderData=new WeakMap();
 const calls=[],counts={},failures=[];
 const lightVariants=new Map();
 let nextProgram=0,nextShader=0,worstCallMs=0;
 const cutoffMs=20,maxCalls=100;
 const round=n=>+n.toFixed(1);
 const pnameNames=[
  'LINK_STATUS','VALIDATE_STATUS','DELETE_STATUS','ATTACHED_SHADERS',
  'ACTIVE_ATTRIBUTES','ACTIVE_UNIFORMS','TRANSFORM_FEEDBACK_VARYINGS',
  'TRANSFORM_FEEDBACK_BUFFER_MODE','ACTIVE_UNIFORM_BLOCKS',
  'PROGRAM_BINARY_LENGTH','COMPLETION_STATUS_KHR'
 ];
 const functionNames=[
  'createProgram','createShader','shaderSource','attachShader',
  'compileShader','linkProgram','getProgramParameter',
  'getProgramInfoLog','getShaderParameter','useProgram'
 ];
 const now=()=>performance.now();
 const profile=()=>window.__phiLiftProfile;
 const fnv=source=>{
  let h=2166136261;
  for(let i=0;i<source.length;i++)h=Math.imul(h^source.charCodeAt(i),16777619);
  return (h>>>0).toString(16).padStart(8,'0');
 };
 const programFor=p=>{
  if(!p||typeof p!=='object')return null;
  let item=programData.get(p);
  if(!item){item={id:++nextProgram,shaders:[],linkCalls:0,linkDurationMs:null};programData.set(p,item);}
  return item;
 };
 const shaderFor=s=>{
  if(!s||typeof s!=='object')return null;
  let item=shaderData.get(s);
  if(!item){item={id:++nextShader,type:null,sourceHash:null,sourceLength:0};shaderData.set(s,item);}
  return item;
 };
 const nameFor=(gl,enumValue)=>{
  for(const name of pnameNames)if(gl[name]===enumValue)return name;
  return typeof enumValue==='number'?'0x'+enumValue.toString(16):String(enumValue);
 };
 // Group the shader fingerprints by compile-time light counts.
 const lightSignature=source=>{
  const fields=['NUM_DIR_LIGHTS','NUM_POINT_LIGHTS','NUM_SPOT_LIGHTS',
   'NUM_DIR_LIGHT_SHADOWS','NUM_POINT_LIGHT_SHADOWS','NUM_SPOT_LIGHT_SHADOWS'];
  const result={};
  for(const field of fields){
   const match=source.match(new RegExp('#define\\s+'+field+'\\s+(\\d+)'));
   if(match)result[field]=Number(match[1]);
  }
  return Object.keys(result).length?result:null;
 };
 const shaderDetails=item=>item?item.shaders.map(s=>({
  id:s.id,type:s.type===35633?'vertex':s.type===35632?'fragment':s.type,
  hash:s.sourceHash,length:s.sourceLength,
  ...(s.lightCounts?{lightCounts:s.lightCounts}:{})
 })):[];
 const describe=(method,gl,args)=>{
  const p=(method==='getShaderParameter'||method==='compileShader'||method==='shaderSource')?null:programFor(args[0]);
  return {
   ...(p?{programId:p.id,linkCalls:p.linkCalls,lastLinkDurationMs:p.linkDurationMs,
    shaders:shaderDetails(p)}:{}),
   ...((method==='getProgramParameter'||method==='getShaderParameter')
    ?{parameter:nameFor(gl,args[1])}:{})
  };
 };
 function capture(method,started,duration,details,stack,visit){
  if(!visit)return;
  const ms=round(duration);
  const key=method+' '+(details.parameter||'');
  const total=counts[key]||(counts[key]={count:0,totalMs:0,maxMs:0});
  total.count++;total.totalMs=round(total.totalMs+ms);total.maxMs=Math.max(total.maxMs,ms);
  worstCallMs=Math.max(worstCallMs,ms);
  if(ms<cutoffMs)return;
  const entry={
   method,durationMs:ms,startedElapsedMs:round(started-visit.start),
   visitStartMs:round(visit.start),
   visitDate:visit.date,fromFloor:visit.fromFloor,toFloor:visit.toFloor,
   stageAtStart:visit.stages.at(-1)?.name||'unknown',
   ...details,
   ...(stack?{stack}: {})
  };
  calls.push(entry);
  // Keep the largest samples rather than dropping a critical first-use stall.
  if(calls.length>maxCalls){
   calls.sort((a,b)=>b.durationMs-a.durationMs);calls.length=maxCalls;
  }
 }
 const installed=[];
 for(const Base of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
  if(!Base?.prototype)continue;
  const proto=Base.prototype;
  for(const method of functionNames){
   const descriptor=Object.getOwnPropertyDescriptor(proto,method);
   if(!descriptor||typeof descriptor.value!=='function')continue;
   const original=descriptor.value;
   const wrapped=function(...args){
    const p=(method==='attachShader'||method==='linkProgram'||method==='getProgramParameter'
     ||method==='getProgramInfoLog'||method==='useProgram')?programFor(args[0]):null;
    const s=(method==='shaderSource'||method==='compileShader'||method==='getShaderParameter')
     ?shaderFor(args[0]):null;
    if(method==='attachShader'&&p){
     const attached=shaderFor(args[1]);
     if(attached&&!p.shaders.includes(attached))p.shaders.push(attached);
    }
    if(method==='shaderSource'&&s&&typeof args[1]==='string'){
     s.sourceLength=args[1].length;s.sourceHash=fnv(args[1]);
     if(s.type===35632){
      s.lightCounts=lightSignature(args[1]);
      const key=JSON.stringify(s.lightCounts||{unspecified:true});
      const record=lightVariants.get(key)||{lightCounts:s.lightCounts,count:0,uniqueSources:new Set()};
      record.count++;record.uniqueSources.add(s.sourceHash);
      lightVariants.set(key,record);
     }
    }
    // The capture is scoped to an active lift. Program metadata is maintained
    // outside lifts so first-use shader programs can be identified later.
    const state=profile();
    const visit=state?.active?state.current:null;
    const timed=!!visit&&[
     'getProgramParameter','getProgramInfoLog','getShaderParameter',
     'compileShader','linkProgram'
    ].includes(method);
    const started=timed?now():0;
    const details=timed?describe(method,this,args):null;
    const stack=timed&&method==='getProgramParameter'
     ?String(new Error().stack||'').split('\n').slice(2,8).join('\n'):null;
    let value;
    try{
     value=Reflect.apply(original,this,args);
     return value;
    }finally{
     if(method==='createProgram'&&value)programFor(value);
     if(method==='createShader'&&value){const created=shaderFor(value);created.type=args[0];}
     if(method==='linkProgram'&&p){p.linkCalls++;}
     if(timed){
      const duration=now()-started;
      if(method==='linkProgram'&&p)p.linkDurationMs=round(duration);
      capture(method,started,duration,details,stack,visit);
     }
    }
   };
   try{
    Object.defineProperty(proto,method,{...descriptor,value:wrapped});
    installed.push(Base.name+'.'+method);
   }catch(error){failures.push(Base.name+'.'+method+': '+String(error?.message||error));}
  }
 }
 window.__phiShaderSpikeTrace={
  enabled:true,
  snapshot:()=>({
   enabled:true,thresholdMs:cutoffMs,installed:installed.length,
   installedMethods:[...installed],errors:[...failures],
   programsObserved:nextProgram,shadersObserved:nextShader,worstCallMs:round(worstCallMs),
   byMethod:Object.fromEntries(Object.entries(counts).map(([name,value])=>
    [name,{...value}])),
   lightShaderVariants:[...lightVariants.values()].map(x=>({
    lightCounts:x.lightCounts,count:x.count,uniqueSources:x.uniqueSources.size
   })).sort((a,b)=>b.count-a.count),
   slowCalls:[...calls].sort((a,b)=>b.durationMs-a.durationMs),
   interpretation:'A long getProgramParameter call indicates CPU/driver blocking at this query, not proof that shader compilation itself consumed the entire interval. Correlate with render-pass and lift-operation intervals.'
  })
 };
}
