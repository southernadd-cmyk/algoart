// New material versions that differ from their predecessors ONLY in canvas
// backend: identical brush, paper, colour and composition code, rendered with
// CPU-backed intermediate canvases (see cpu-canvas.js).
//   Oil V4          = Oil V3 drawing code   (material=oil-v4)
//   Tissue V8       = Tissue V7 drawing code (tissue=8)
//   Watercolour V2T = Watercolour V2S code  (material=watercolour-v2t)
// Pixels may differ from the predecessor on browsers that GPU-accelerate
// canvases; on CPU-only browsers they are expected to match it exactly
// (for Oil: match V3's first render in a freshly loaded page).
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
function require(name){
  if(typeof A[name]!=='function')
    throw Error('CPU material versions require '+name+' to load first');
}
A.renderOilPaintV4=function(target,settings,scale,reveal){
  require('renderOilPaintV3');require('renderViaCPUCanvas');
  const result=A.renderViaCPUCanvas(function(canvas){
    // Every V4 render starts from an empty tooth scratch: deterministic, and
    // equal to Oil V3's first render in a freshly loaded page.
    A.oilPaintV4ETest.resetToothSlot('cpu');
    return A.renderOilPaintV3(canvas,settings,scale,reveal);
  },target,'oil-paint-v4');
  return {...result,version:'oil-paint-v4',canvasBackend:'cpu',
    cpuContexts:A.lastCPUCanvasRender};
};
A.renderTissueV8=function(target,settings,scale,reveal){
  require('renderOil');require('renderViaCPUCanvas');
  // Returns the same source meta object as Tissue V7 (A.lastRenderMeta).
  return A.renderViaCPUCanvas(function(canvas){
    return A.renderOil(canvas,settings,scale,reveal,7);
  },target,'tissue-v8');
};
A.renderWatercolourV2T=function(target,settings,scale,reveal){
  require('renderWatercolourV2S');require('renderViaCPUCanvas');
  return A.renderViaCPUCanvas(function(canvas){
    const previous=A.watercolourV2TFastNeighbours;
    A.watercolourV2TFastNeighbours=true;
    try{
      return A.renderWatercolourV2S(canvas,settings,scale,reveal);
    }finally{
      A.watercolourV2TFastNeighbours=previous;
    }
  },target,'watercolour-v2t');
};
A.cpuMaterialVersions={
  'oil-v4':{previous:'oil-v3',render:'renderOilPaintV4'},
  'tissue-8':{previous:'tissue-7',render:'renderTissueV8'},
  'watercolour-v2t':{previous:'watercolour-v2s',render:'renderWatercolourV2T'}
};
})(window.AlgoArt);
