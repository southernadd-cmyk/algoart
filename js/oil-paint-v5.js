// Experimental, explicitly called version. Does not select a studio default.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
A.renderOilPaintV5=function(target,settings,scale,reveal,options={}){
 if(!A.oilPigment||typeof A.renderOilPaintV4!=='function')
  throw Error('Oil V5 requires oil-pigment.js and Oil V4');
 const previousPlanner=A.planCompositionV5FromSource,
  hadActive=Object.prototype.hasOwnProperty.call(A,'oilPigmentActive'),
  previousActive=A.oilPigmentActive,
  model=A.oilPigment.createModel(options.reference===true);
 try{
  A.oilPigmentActive=model;
  // Finish ALL source clustering, guide pairing, voids and colour assignment
  // with original colours. Only then derive separate material paint colours.
  A.planCompositionV5FromSource=function(...args){
   const plan=previousPlanner(...args);
   const mapped=field=>({...field,
    paintRgb:model.mapRGB(field.paintRgb||field.rgb),
    paintPalette:(field.paintPalette||field.palette||[field.rgb]).map(c=>model.mapRGB(c))});
   const material=item=>({...item,rgb:model.mapRGB(item.rgb)});
   return {...plan,
    connectedFields:plan.connectedFields.map(mapped),
    territories:plan.territories.map(material),
    regions:plan.regions.map(material),
    gestures:plan.gestures.map(material),
    accents:plan.accents.map(material)};
  };
  const result=A.renderOilPaintV4(target,settings,scale,reveal);
  return {...result,version:options.reference?'oil-claude-palette':'oil-paint-v5',
   pigment:{model:model.name,...model.stats}};
 }finally{
  A.planCompositionV5FromSource=previousPlanner;
  if(hadActive)A.oilPigmentActive=previousActive;else delete A.oilPigmentActive;
 }
};
})(window.AlgoArt);
