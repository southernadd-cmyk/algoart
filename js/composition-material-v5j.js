// V5j material colour assignment: KEEP V5i's exact source-driven geometry.
// Connected field palettes are local real source pigments, not invented colours.
// Separate material colour from source colour, never recolour geometry metadata.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5iTest||!A.planCompositionV5FromSource)
  throw Error('V5j needs frozen source-owned V5i geometry');
const previous=A.planCompositionV5FromSource,VERSION='v5j-material-legibility-1';
const paper=[245,240,230],ink=[43,39,37];
const mix=(a,b,t)=>a.map((x,i)=>Math.round(x*(1-t)+b[i]*t));
const delta=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function variants(field){
  const originals=field.palette?.length?field.palette:[field.rgb];
  const result=[];
  for(const source of originals){
    // Deliberately modest warm-paper and subtractive-ink versions of actual
    // local source pigment: hue identity survives. No arbitrary new palette.
    for(const [kind,t] of [['source',0],['tint',.17],['shade',.15],
                           ['tint',.29],['shade',.26]]){
      result.push({rgb:kind==='source'?source.slice():
        mix(source,kind==='tint'?paper:ink,t),sourceRgb:source.slice(),
        kind,amount:t,change:delta(source,field.rgb)});
    }
  }
  return result;
}
function assign(fields){
  const painted=[];
  const links=[];
  for(const f of fields){
    const neighbors=painted.filter(g=>distance(f,g)<300);
    const ranks=variants(f).map((v,index)=>{
      let closest=255;
      for(const p of neighbors)closest=Math.min(closest,delta(v.rgb,p.paintRgb));
      const contrast=neighbors.length?Math.min(closest,95):68;
      // Colour differences are only worth pushing if two visible source
      // pieces occupy adjacent parts of the SAME actual composition.
      // Large changes or distant fields never get priority.
      const score=contrast*.86-
        (delta(v.rgb,f.rgb)*.34)-v.change*.13-
        v.amount*10-index*.015;
      return{...v,index,score,contrast};
    }).sort((a,b)=>b.score-a.score||a.index-b.index);
    const chosen=ranks[0];
    f.paintRgb=chosen.rgb.slice();
    f.paintPalette=[chosen.rgb.slice()];
    const original=f.palette||[f.rgb];
    for(const c of original)if(delta(c,chosen.rgb)>22)
      f.paintPalette.push(c.slice());
    f.paintPalette=f.paintPalette.slice(0,3);
    f.paintTone={kind:chosen.kind,amount:chosen.amount,
      sourceRgb:chosen.sourceRgb,deltaFromSource:+delta(chosen.rgb,f.rgb).toFixed(2)};
    for(const n of neighbors)links.push({
      guides:[f.guideIds.join('→'),n.guideIds.join('→')],
      before:+delta(f.rgb,n.rgb).toFixed(1),
      after:+delta(f.paintRgb,n.paintRgb).toFixed(1)});
    painted.push(f);
  }
  return{fields:fields.length,materialPairs:links.length,
    improvedPairs:links.filter(x=>x.after>x.before+8).length,
    unchangedSourceGeometry:true,pairContrasts:links};
}
function interpret(source,settings,opts){
  const plan=previous(source,settings,opts||{});
  plan.materialStats=assign(plan.connectedFields||[]);
  plan.version=VERSION;
  plan.materialInterpretation='local-pigment-contrast-and-physical-handling';
  return plan;
}
A.compositionV5iFromSource=previous;
A.planCompositionV5FromSource=interpret;
A.planCompositionV5=(settings,opts)=>
  interpret(A.captureCompositionV5(settings,opts),settings,opts);
A.compositionV5jTest={assign,variants,delta};
A.compositionV5Version=VERSION;
})(window.AlgoArt);
