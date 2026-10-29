// Test-only adherence setting; identical positioning code runs on live and test.
import {refinePhiExhibition} from '../../gallery/visit/phi-curation-refinement.mjs';
export {wallPhiPreference,sculpturePhiPreference,classifyStudyMaterial as stageMaterial}
 from '../../gallery/visit/phi-curation-refinement.mjs';
export const STAGING_PHI_ADHERENCE=(()=>{
 const raw=new URLSearchParams(globalThis.location?.search||'').get('phiHang');
 if(raw===null||raw.trim()==='')return .65;
 const n=Number(raw);
 return Number.isFinite(n)?Math.max(0,Math.min(1,n/100)):.65;
})();
export function refineStageExhibition(exhibition,floor,circulation,physical){
 return refinePhiExhibition(exhibition,floor,circulation,physical,STAGING_PHI_ADHERENCE);
}
