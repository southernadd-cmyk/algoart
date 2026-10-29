// Staging keeps independent phi-adherence controls without changing production.
import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
export function stageCurationPlugin(){
 return {name:'stage-curation-adherence-only',setup(builder){
  builder.onLoad({filter:/[/\\]phi-curator\.mjs$/},async({path})=>{
   const original=await readFile(path,'utf8');
   const call='preExpandPhiPaintings(hang,sculptures,floor,circulation,physical,phiAdherence,expandPhiPaintings);';
   if(original.split(call).length!==2)throw Error('Stage classic comparison anchor changed');
   // Production defaults to improved placement. Test can explicitly compare
   // the previous algorithm using ?phiPass=classic.
   const source=original.replace(call,
    "if(new URLSearchParams(globalThis.location?.search||'').get('phiPass')!=='classic')"+call);
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
