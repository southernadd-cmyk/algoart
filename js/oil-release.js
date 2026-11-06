window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
const v8Options=Object.freeze({masses:true,relief:true,weave:true,amount:0.6});
A.defaultOilPaintMaterial='oil-v7';
A.renderReleasedOilPaintV8=function(canvas,settings,scale,reveal){
  return A.renderOilPaintV8(canvas,settings,scale,reveal,v8Options);
};
})(window.AlgoArt);
