// Staging keeps independent phi-adherence controls without changing production.
import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
export function stageCurationPlugin(){
 return {name:'stage-curation-adherence-only',setup(builder){
  builder.onLoad({filter:/[/\\]phi-curator\.mjs$/},async({path})=>{
   let source=await readFile(path,'utf8');
   const from='expandPhiPaintings(hang,sculptures);';
   if(source.split(from).length!==2)throw Error('Early-phi stage anchor changed');
   source="import {stagePreExpansionPhi} from '../../test/virtual-gallery/phi-pre-expansion.mjs';\n"+
    source.replace(from,`if(new URLSearchParams(globalThis.location?.search||'').get('phiPass')!=='classic')
    stagePreExpansionPhi(hang,sculptures,floor,circulation,physical,phiAdherence,expandPhiPaintings);
   ${from}`);
   source=source.replace('visibility, generous spacing and a mild golden-section offset.',
    'visibility and generous spacing; golden-section placement is a later pass.');
   return {contents:source,loader:'js',resolveDir:dirname(path)};
  });
  builder.onLoad({filter:/[/\\]phi-full-engine-adapter\.mjs$/},async({path})=>{
   let source=await readFile(path,'utf8');
   const before="export function buildPhiRendererPlan(date,studies,{variation=0,phiAdherence=.65}={}){";
   if(source.split(before).length!==2)throw Error('Staging adherence signature changed');
   source="import {STAGING_PHI_ADHERENCE} from '../../test/virtual-gallery/phi-curation-stage.mjs';\n"+
     source.replace(before,"export function buildPhiRendererPlan(date,studies,{variation=0,phiAdherence=STAGING_PHI_ADHERENCE}={}){");
   return {contents:source,loader:'js',resolveDir:dirname(path)};
  });
 }};
}
