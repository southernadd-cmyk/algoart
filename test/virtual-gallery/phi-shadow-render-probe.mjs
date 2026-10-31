// TEST ONLY: measures actual WebGL shadow map render work inside the
// architectural scene-render pass. No shadow parameters, render targets,
// lights, materials, meshes or output pixels are changed.
export function installPhiShadowRenderProbe({renderer,enabled=false,record=()=>{},now=()=>performance.now()}={}){
 const shadowMap=renderer?.shadowMap;
 const original=shadowMap?.render;
 const stats={enabled:!!enabled,installed:false,calls:0,totalMs:0,maxMs:0,last:null};
 if(!enabled||typeof original!=='function')return {stats,dispose(){}};
 let active=true;
 const wrapper=function(...args){
  if(!active)return original.apply(this,args);
  const start=now();
  try{return original.apply(this,args);}
  finally{
   const ms=now()-start;
   stats.calls++;
   stats.totalMs=+(stats.totalMs+ms).toFixed(1);
   stats.maxMs=Math.max(stats.maxMs,+ms.toFixed(1));
   stats.last={ms:+ms.toFixed(1),at:+now().toFixed(1),
    lights:Array.isArray(args[0])?args[0].length:null};
   record('shadow-map-render',ms);
  }
 };
 try{
  shadowMap.render=wrapper;
  stats.installed=shadowMap.render===wrapper;
 }catch(error){
  // Probing is diagnostic and must not block any gallery render.
  console.warn('[Phi lift profile] shadow-map timing unavailable',error);
 }
 return {stats,dispose(){
  active=false;
  if(stats.installed&&shadowMap.render===wrapper)shadowMap.render=original;
 }};
}
