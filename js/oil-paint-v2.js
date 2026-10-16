// ALGO/ART Oil Paint V2 — versioned production material entry point.
// Historical Oil V1 remains available through A.renderOilPaintV1 and
// material=oil-v1. All switches are synchronously scoped and restored.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
const KEYS=[
  'oilStageCExperimental','oilStageDRefinement','oilStageCScale',
  'oilPerfExperimental','oilBrushPerfExperimental',
  'oilStageEAdaptiveLightingExperimental',
  'oilStageEMaskScanExperimental','oilStageEBatchWetSample',
  'oilStageETightMaskExperimental','oilStageECachedLightingExperimental',
  'oilStageERollingLightingExperimental'
];
A.renderOilPaintV2=function(target,settings,scale,reveal){
  if(typeof A.renderOilPaintV1!=='function' ||
     typeof A.oilPaintV4ETest?.drawContactBrushV2!=='function')
    throw Error('Oil Paint V2 materials have not loaded');
  const saved=Object.create(null);
  for(const key of KEYS)saved[key]=A[key];
  try{
    A.oilStageCExperimental=true;
    A.oilStageDRefinement=true;
    A.oilStageCScale=scale||1;
    A.oilPerfExperimental=true;
    A.oilBrushPerfExperimental=true;
    // Proven exact-pixel export improvement; automatically falls back to
    // original lighting for smaller preview canvases.
    A.oilStageEAdaptiveLightingExperimental=true;
    // These three were pixel-correct but slower/inconsistent in CI.
    A.oilStageEMaskScanExperimental=false;
    A.oilStageEBatchWetSample=false;
    A.oilStageETightMaskExperimental=false;
    A.oilStageECachedLightingExperimental=false;
    A.oilStageERollingLightingExperimental=false;
    const result=A.renderOilPaintV1(target,settings,scale,reveal);
    return {...result,version:'oil-paint-v2'};
  }finally{
    for(const key of KEYS){
      if(saved[key]===undefined)delete A[key];
      else A[key]=saved[key];
    }
  }
};
})(window.AlgoArt);
