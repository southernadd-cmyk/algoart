// Oil V6 study: retain V5 pigments and brushwork with opaque paint masses and connection paint.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
A.renderOilPaintV6=function(target,settings,scale,reveal){
 if(typeof A.renderOilPaintV5!=='function')throw Error('Oil V6 requires Oil V5');
 const had=Object.prototype.hasOwnProperty.call(A,'oilOpaquePaint'),
  previous=A.oilOpaquePaint;
 try{
  A.oilOpaquePaint=true;
  const result=A.renderOilPaintV5(target,settings,scale,reveal);
  return {...result,version:'oil-paint-v6'};
 }finally{
  if(had)A.oilOpaquePaint=previous;else delete A.oilOpaquePaint;
 }
};
})(window.AlgoArt);
