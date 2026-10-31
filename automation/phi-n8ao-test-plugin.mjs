import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
export function patchN8AOTest(source){
 const replace=(before,after)=>{
  if(source.split(before).length!==2)throw Error('N8AO test anchor changed: '+before.slice(0,80));
  source=source.replace(before,after);
 };
 source="import {N8AOPostPass} from 'n8ao';\n"+source;
 replace(" let previous=0,lastMode='',lastUI=0,lastGlowScan=0,selectedIds='';",` let previous=0,lastMode='',lastUI=0,lastGlowScan=0,selectedIds='';
 let aoProvider=new URLSearchParams(location.search).get('ao')==='ssao'?'ssao':'n8ao';
 stats.aoProvider=aoProvider;`);
 replace(' if(production)panel.hidden=true;',` panel.open=false;
 const aoLabel=small('label','Ambient occlusion comparison','display:grid;gap:4px;font-weight:600');
 const aoSelect=document.createElement('select');aoSelect.setAttribute('aria-label','Ambient occlusion provider');
 for(const [value,text] of [['n8ao','N8AO · half resolution'],['ssao','Existing SSAO']]){
  const option=document.createElement('option');option.value=value;option.textContent=text;aoSelect.append(option);
 }
 aoSelect.value=aoProvider;aoLabel.append(aoSelect);selectors.prepend(aoLabel);
 selectors.append(small('p','N8AO radius is in metres; SSAO uses its own scale. Equal values do not imply identical shadows. Compare from the same viewpoint.','margin:0;font-size:11px'));
 aoSelect.addEventListener('change',()=>{
  aoProvider=aoSelect.value;stats.aoProvider=aoProvider;
  for(const bucket of Object.values(frames))bucket.length=0;
  stats.summaries={};previous=0;lastMode='';apply();
 });`);
 replace('  compositor.addPass(normals);compositor.addPass(aoPass);',`  compositor.addPass(normals);compositor.addPass(aoPass);
  const n8ao=new N8AOPostPass(scene,camera,innerWidth,innerHeight);
  n8ao.configuration.halfRes=true;
  n8ao.configuration.depthAwareUpsampling=true;
  n8ao.configuration.gammaCorrection=false;
  n8ao.configuration.accumulate=false;
  compositor.addPass(n8ao);`);
 replace('effects:{normals,ao,aoPass,fullBloom','effects:{normals,ao,aoPass,n8ao,fullBloom');
 replace('  e.normals.enabled=e.aoPass.enabled=s.aoIntensity>0;',`  e.normals.enabled=e.aoPass.enabled=s.aoIntensity>0&&aoProvider==='ssao';
  e.n8ao.enabled=s.aoIntensity>0&&aoProvider==='n8ao';
  e.n8ao.configuration.intensity=s.aoIntensity;
  e.n8ao.configuration.aoRadius=s.aoRadius;
  e.n8ao.configuration.aoSamples=s.aoSamples;
  stats.aoConfiguration={provider:aoProvider,radius:s.aoRadius,intensity:s.aoIntensity,samples:s.aoSamples,halfRes:true};`);
 replace('  {active:preset', '  {ao:stats.aoConfiguration,active:preset');
 return source;
}
export function n8aoTestPlugin(){return {name:'n8ao-test-only',setup(builder){
 builder.onLoad({filter:/[/\\]phi-post-fx[.]mjs$/},async({path})=>({
  contents:patchN8AOTest(await readFile(path,'utf8')),loader:'js',resolveDir:dirname(path)
 }));
}};}
