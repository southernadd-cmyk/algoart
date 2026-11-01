// TEST ONLY: optional narrow WebGL call stopwatch for the cold lift journey.
// Enabled only with ?gltrace=1. No canvas, shaders, state, drawing order or
// return values are modified; every wrapper delegates to the original method.
export const PHI_GL_TRACE_METHODS=[
 'drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced',
 'texImage2D','texSubImage2D','texImage3D','texSubImage3D',
 'compressedTexImage2D','compressedTexSubImage2D',
 'bufferData','bufferSubData','copyBufferSubData',
 'compileShader','linkProgram','shaderSource','getProgramParameter',
 'getShaderParameter','getProgramInfoLog','getShaderInfoLog',
 'useProgram','validateProgram','generateMipmap','readPixels','finish','flush',
 'blitFramebuffer','framebufferTexture2D','framebufferRenderbuffer',
 'renderbufferStorage','renderbufferStorageMultisample',
 'clear','checkFramebufferStatus','bindFramebuffer',
 'bindTexture','bindBuffer','bindVertexArray','vertexAttribPointer',
 'uniformMatrix4fv','uniformMatrix3fv','uniform4fv','uniform3fv',
 'uniform2fv','uniform1fv','uniform1i','activeTexture'
];
export function attachPhiWebGLCallTrace(gl,profiler,{now=()=>performance.now(),minMs=2}={}){
 if(!gl||!profiler?.recordOperation||!profiler?.state)throw Error('WebGL tracer requires GL and active profiler');
 const installed=[],errors=[];
 const wrap=(name)=>{
  const original=gl[name];
  if(typeof original!=='function')return;
  const wrapped=function(...args){
   // Outside lift movement do not time every draw call.
   if(!profiler.state.active)return Reflect.apply(original,this,args);
   const started=now();
   try{return Reflect.apply(original,this,args);}
   finally{
    const duration=now()-started;
    if(duration>=minMs)
     profiler.recordOperation('gl-'+name,started,duration);
   }
  };
  try{
   gl[name]=wrapped;
   if(gl[name]!==wrapped)throw Error('GL method is not writable');
   installed.push(name);
  }catch(e){errors.push(name+': '+String(e?.message||e));}
 };
 for(const name of PHI_GL_TRACE_METHODS)wrap(name);
 const info={
  enabled:true,installed:installed.length,methods:installed,errors,
  thresholdMs:minMs,description:'WebGL driver call stopwatch; operations under threshold are omitted'
 };
 return info;
}
