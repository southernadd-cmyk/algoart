// Oil Paint V3a experimental material; does not change V1 or V2.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
A.renderOilPaintV3=function(target,settings,scale,reveal){
  const core=A.oilPaintV4ETest,original=core?.drawContactBrushV2;
  if(typeof A.renderOilPaintV2!=='function'||typeof original!=='function'||
     typeof core.drawContactBrushV3!=='function')
    throw Error('Oil V3a requires Oil V1 and V2 plus oil-brush-v3.js');
  try{
    core.drawContactBrushV2=core.drawContactBrushV3;
    const result=A.renderOilPaintV2(target,settings,scale,reveal);
    return {...result,version:'oil-paint-v3a-experimental'};
  }finally{core.drawContactBrushV2=original;}
};
})(window.AlgoArt);
