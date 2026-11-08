// Experimental Tissue & Graphite V8: opt-in layered-pigment treatment.
// Uses the exact V7 composition, source hues, fibres and paper engine.
// This is deliberately separate from historical ?tissue=8 (CPU-only V7).
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
A.renderTissueLayeredV8=function(target,settings,scale,reveal){
  if(typeof A.renderOil!=='function')
    throw new Error('Tissue V8 requires the V7 renderer');
  const previous=A.tissueV8LayeredActive;
  A.tissueV8LayeredActive=true;
  try{
    const result=A.renderOil(target,settings,scale,reveal,7);
    A.lastTissueV8Stats={...A.lastOilMaterialStats,variant:'layered-v8'};
    return result;
  }finally{
    A.tissueV8LayeredActive=previous;
  }
};
})(window.AlgoArt);
