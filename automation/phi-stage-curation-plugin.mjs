// Apply golden-ratio positioning only to the test-tower bundle.
// Fail on upstream changes rather than silently shipping a stale stage.
import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
function replaceExactly(source,before,after,label){
 if(source.split(before).length!==2)throw Error('Stage curation anchor changed ('+label+')');
 return source.replace(before,after);
}
export function instrumentStageCurator(source){
 source="import {STAGING_PHI_ADHERENCE,wallPhiPreference,sculpturePhiPreference} from '../../test/virtual-gallery/phi-curation-stage.mjs';\n"+source;
 source=replaceExactly(source,
  'Math.abs(u-wall.centre)*.04;',
  'Math.abs(u-wall.centre)*.04*(1-STAGING_PHI_ADHERENCE)+STAGING_PHI_ADHERENCE*wallPhiPreference(wall,u)*1.1;',
  'painting position');
 source=replaceExactly(source,
  'score:clearance*.35+Math.min(3,Math.hypot(x-lift.x,z-lift.z))*.1',
  'score:clearance*.35+Math.min(3,Math.hypot(x-lift.x,z-lift.z))*.1+STAGING_PHI_ADHERENCE*sculpturePhiPreference(fx,fz)*.95',
  'sculpture position');
 return source;
}
export function instrumentStageGroups(source){
 source="import {stageMaterial} from '../../test/virtual-gallery/phi-curation-stage.mjs';\n"+source;
 return replaceExactly(source,
  `  const material=/^oil-v\\d+$/.test(explicit)?'oil':/^action-v\\d+$/.test(explicit)?'action':
    /^watercolour-v/.test(explicit)?'watercolour':
    params.tissue||params.watercolor||params.oil||savedMaterial==='watercolor'?'tissue':savedMaterial;`,
  '  const material=stageMaterial(params,savedMaterial,explicit);',
  'material classification');
}
export function stageCurationPlugin(){
 return {name:'staging-phi-curation-only',setup(builder){
  for(const [filter,transform] of [
   [/[/\\]phi-curator\.mjs$/,instrumentStageCurator],
   [/[/\\]phi-curation-groups\.mjs$/,instrumentStageGroups]
  ])builder.onLoad({filter},async({path})=>({
   contents:transform(await readFile(path,'utf8')),
   loader:'js',resolveDir:dirname(path)
  }));
 }};
}
