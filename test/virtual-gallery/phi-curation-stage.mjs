// Staging-only adherence and semantic material classification.
// Production curation is deliberately not modified by this module.
import {INV_PHI} from '../../gallery/visit/phi-architecture.mjs';
const GOLDEN_SEPARATION=INV_PHI-.5;
export const STAGING_PHI_ADHERENCE=(()=>{
 const raw=new URLSearchParams(globalThis.location?.search||'').get('phiHang');
 if(raw===null||raw.trim()==='')return .65;
 const n=Number(raw);
 return Number.isFinite(n)?Math.max(0,Math.min(1,n/100)):.65;
})();
const clamp01=x=>Math.max(0,Math.min(1,x));
// 0 at the wall centre, 1 at either feasible golden-section anchor.
export function wallPhiPreference(wall,u){
 if(!(wall.length>0))return 0;
 const a=wall.lo+wall.length*INV_PHI;
 const b=wall.hi-wall.length*INV_PHI;
 return clamp01(1-Math.min(Math.abs(u-a),Math.abs(u-b))/(wall.length*GOLDEN_SEPARATION));
}
function axisPhiPreference(fraction){
 return clamp01(1-Math.min(Math.abs(fraction-INV_PHI),
  Math.abs(fraction-(1-INV_PHI)))/GOLDEN_SEPARATION);
}
// Keep a smooth preference when one coordinate is constrained by a doorway.
export function sculpturePhiPreference(fx,fz){
 return (axisPhiPreference(fx)+axisPhiPreference(fz))/2;
}
export function stageMaterial(params={},saved='',explicit=''){
 const key=String(explicit||'').trim().toLowerCase();
 const base=String(saved||'').trim().toLowerCase();
 const canonical=value=>{
  if(/^oil(?:-v\d+)?$/.test(value))return 'oil';
  if(/^action(?:-v\d+)?$/.test(value))return 'action';
  if(/^(?:watercolour|watercolor)(?:-v[\da-z]+)?$/.test(value))return 'watercolour';
  if(/^tissue(?:-v\d+)?$/.test(value))return 'tissue';
  if(value==='marker')return 'marker';
  return '';
 };
 if(canonical(key))return canonical(key);
 if(params.tissue)return 'tissue';
 if(params.oil)return 'oil';
 if(params.watercolor||params.watercolour)return 'watercolour';
 return canonical(base)||base;
}
