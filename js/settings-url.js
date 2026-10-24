(function(A){
'use strict';
A.PARAM_KEYS=Object.freeze({
  seed:'seed',mode:'mode',orientation:'fmt',elements:'el',density:'den',complexity:'cx',negativeSpace:'neg',
  phiStrength:'phi',recursion:'rec',spiralInfluence:'spi',goldenAngle:'ga',nesting:'nest',
  pen:'pen',thickness:'th',wobble:'wob',overdraw:'od',opacity:'op',pressure:'pr',dryness:'dry',
  curveBias:'curve',shapeAmount:'shape',overlap:'overlap',rotation:'rot',
  lines:'ln',circles:'ci',rectangles:'re',polygons:'po',arcs:'ar',
  palette:'pal',colourCount:'cols',saturation:'sat',brightness:'bri',paper:'paper',grain:'grain'
});
A.SUPPORTED_RENDERER_VERSIONS=Object.freeze([1,2,3,4,5,6,7,8,9]);
})(window.AlgoArt=window.AlgoArt||{});
