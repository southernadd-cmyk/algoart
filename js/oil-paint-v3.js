// Oil Paint V3g experimental material; V1 and V2 remain unchanged.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
A.renderOilPaintV3=function(target,settings,scale,reveal){
  const core=A.oilPaintV4ETest;
  if(typeof A.renderOilPaintV2!=='function'||
     typeof core?.drawContactBrushV3!=='function')
    throw Error('Oil V3g requires Oil V2 and oil-brush-v3.js');
  // The V5 interpretation planner caches core.drawContactBrush (NOT the
  // internal drawContactBrushV2 delegate) when building its paint layers.
  const original=core.drawContactBrush;
  const originalV2=core.drawContactBrushV2;
  const savedStats=A.oilV3BrushCalls;
  A.oilV3BrushCalls=0;
  const metrics={detailed:0,narrowFallback:0,detailedMs:0,narrowMs:0};
  const instrumented=(...args)=>{
    A.oilV3BrushCalls++;
    const physicalWidth=args[3]*(A.oilStageCScale||1);
    // Restore V2's 22-device-pixel detail threshold. Narrow V5 strokes
    // should not run the 30-hair/tooth renderer at subpixel hair widths.
    const narrow=physicalWidth<22&&A.oilStageCForceDetail!==true;
    const start=performance.now();
    // The original V4e entry point performs exactly V2's own selection.
    // It delegates to drawContactBrushV2 only for eligible wide strokes.
    const result=narrow?original(...args):core.drawContactBrushV3(...args);
    const elapsed=performance.now()-start;
    if(narrow){metrics.narrowFallback++;metrics.narrowMs+=elapsed;}
    else{metrics.detailed++;metrics.detailedMs+=elapsed;}
    return result;
  };
  try{
    core.drawContactBrush=instrumented;
    core.drawContactBrushV2=instrumented;
    const result=A.renderOilPaintV2(target,settings,scale,reveal);
    return {...result,version:'oil-paint-v3g-experimental',
      v3BrushCalls:A.oilV3BrushCalls,v3BrushMetrics:metrics};
  }finally{
    core.drawContactBrush=original;
    if(originalV2===undefined)delete core.drawContactBrushV2;
    else core.drawContactBrushV2=originalV2;
    A.oilV3BrushCalls=savedStats;
  }
};
})(window.AlgoArt);
