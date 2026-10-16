// ALGO/ART CPU canvas backend for new material versions (Oil V4, Tissue V8,
// Watercolour V2T). Earlier versions never call this module, so their code
// paths, canvas backends and archived links are untouched.
//
// Why: the V3/V7/V2S renderers read intermediate canvases back with
// getImageData, or draw them into canvases that are read back. When Chrome
// GPU-accelerates a canvas created with plain getContext('2d'), every such
// read forces a GPU->CPU synchronisation, and the pixels then depend on the
// GPU rasteriser. Inside withCPUCanvases() every 2D context created is
// requested with willReadFrequently:true (CPU raster). The visible page canvas
// is never given that attribute: rendering happens on an internal canvas and
// the finished bitmap is copied to the target once.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
const proto=HTMLCanvasElement.prototype;
const nativeGetContext=proto.getContext;
let depth=0,stats=null;
// Chromium reports willReadFrequently as the strings 'true'/'false'/'undefined'
// (an IDL enum); other engines may use booleans or omit it. null = unknown.
A.canvasReadFrequently=function(ctx){
  const attrs=ctx&&typeof ctx.getContextAttributes==='function'?
    ctx.getContextAttributes():null;
  if(!attrs||!('willReadFrequently' in attrs))return null;
  const v=attrs.willReadFrequently;
  return v===true||v==='true';
};
function cpuGetContext(type,options){
  if(type!=='2d')return nativeGetContext.call(this,type,options);
  const ctx=nativeGetContext.call(this,type,
    Object.assign({},options||{},{willReadFrequently:true}));
  if(stats&&ctx){
    stats.contexts++;
    // A canvas whose context already existed before this scope keeps its
    // original backend. Count it so tests can fail on mixed backends.
    const state=A.canvasReadFrequently(ctx);
    if(state===null)stats.unknown++;
    else if(state!==true)stats.nonCpu++;
  }
  return ctx;
}
A.withCPUCanvases=function(fn){
  if(depth===0){
    proto.getContext=cpuGetContext;
    A.cpuCanvasBackendActive=true;
  }
  depth++;
  try{return fn();}
  finally{
    depth--;
    if(depth===0){
      proto.getContext=nativeGetContext;
      A.cpuCanvasBackendActive=false;
    }
  }
};
// Render with an existing renderer onto an internal CPU canvas, then copy
// the finished pixels to the caller's canvas with one 1:1 'copy' draw.
A.renderViaCPUCanvas=function(render,target,label){
  const internal=document.createElement('canvas');
  internal.width=Math.max(1,target.width||1);
  internal.height=Math.max(1,target.height||1);
  const started=performance.now();
  const outer=stats;
  stats={label:label||'cpu-render',contexts:0,nonCpu:0,unknown:0};
  let meta,record;
  try{
    meta=A.withCPUCanvases(function(){
      internal.getContext('2d');      // created in scope: CPU backend
      return render(internal);
    });
  }finally{record=stats;stats=outer;}
  // Outside the scope: the visible/export canvas keeps its normal backend.
  target.width=internal.width;target.height=internal.height;
  const out=target.getContext('2d');
  out.save();
  out.setTransform(1,0,0,1,0,0);
  out.globalAlpha=1;
  out.globalCompositeOperation='copy';
  out.imageSmoothingEnabled=false;
  out.drawImage(internal,0,0);
  out.restore();
  // The internal canvas is simply dropped (no resize-to-1x1), exactly like
  // the old pipelines' own intermediate canvases; garbage collection frees it.
  record.ms=+(performance.now()-started).toFixed(2);
  A.lastCPUCanvasRender=record;
  return meta;
};
})(window.AlgoArt);
