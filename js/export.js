window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

A.exportPNG=function(settings,scale){
  scale=Number(scale)||1;
  var out=document.createElement('canvas');
  A.render(out,settings,scale,false);

  var link=document.createElement('a');
  link.download='algoart-'+settings.seed+'-'+settings.mode+'-'+scale+'x.png';
  link.href=out.toDataURL('image/png');
  link.click();
};

})(window.AlgoArt);