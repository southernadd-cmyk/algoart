// Oil Paint V3 production material; V1 and V2 remain unchanged.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
A.renderOilPaintV3=function(target,settings,scale,reveal){
  const core=A.oilPaintV4ETest;
  if(typeof A.renderOilPaintV2!=='function'||
     typeof core?.drawContactBrushV3!=='function')
    throw Error('Oil V3 requires Oil V2 and oil-brush-v3.js');
  // The V5 interpretation planner caches core.drawContactBrush (NOT the
  // internal drawContactBrushV2 delegate) when building its paint layers.
  const original=core.drawContactBrush;
  const originalV2=core.drawContactBrushV2;
  const savedStats=A.oilV3BrushCalls;
  A.oilV3BrushCalls=0;
  const instrumented=(...args)=>{
    A.oilV3BrushCalls++;
    return core.drawContactBrushV3(...args);
  };
  try{
    core.drawContactBrush=instrumented;
    core.drawContactBrushV2=instrumented;
    const result=A.renderOilPaintV2(target,settings,scale,reveal);
    return {...result,version:'oil-paint-v3',
      v3BrushCalls:A.oilV3BrushCalls};
  }finally{
    core.drawContactBrush=original;
    if(originalV2===undefined)delete core.drawContactBrushV2;
    else core.drawContactBrushV2=originalV2;
    A.oilV3BrushCalls=savedStats;
  }
};
})(window.AlgoArt);
