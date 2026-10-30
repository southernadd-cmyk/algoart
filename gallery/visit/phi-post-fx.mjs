// Three explicitly optional, test-only cinematic treatments for the 3D tower.
// Production source, phi lighting, and the original camera render remain unchanged.
import {
 EffectComposer, RenderPass, EffectPass, BloomEffect, SelectiveBloomEffect,
 VignetteEffect, SSAOEffect, BrightnessContrastEffect, HueSaturationEffect,
 DepthOfFieldEffect, NoiseEffect, ToneMappingEffect, ToneMappingMode
} from 'postprocessing';

export const PHI_FX_PRESETS=Object.freeze(['original','architectural','luminous','photographic']);
export function phiFXSummary(samples){
 if(samples.length<20)return null;
 const sorted=[...samples].sort((a,b)=>a-b);
 return {median:+sorted[Math.floor(sorted.length*.5)].toFixed(1),
  p95:+sorted[Math.floor(sorted.length*.95)].toFixed(1),
  stalls:sorted.filter(ms=>ms>50).length, count:sorted.length};
}
const glowRoots=new Set([
 'phi-reception-tower-hologram',
 'phi-reception-three-living-monitors',
 'phi-reception-monitor-bank-two',
 'phi-reception-two-large-rear-wall-monitors'
]);
const glowFaces=new Set([
 'monitor-screen','large-monitor-video-pane',
 'recursive-smallest-video-mosaic',
 'hologram-lift-shaft','hologram-projector-base'
]);
export function phiGlowTargets(scene){
 const targets=[];
 scene.traverse(obj=>{
  if(!(obj.isMesh||obj.isLineSegments))return;
  let group=obj.parent,within=false;
  while(group&&group!==scene){if(glowRoots.has(group.name)){within=true;break;}group=group.parent;}
  if(!within)return;
  if(glowFaces.has(obj.name)||
   (obj.isLineSegments&&obj.name==='hologram-architectural-edges')||
   (obj.isMesh&&group?.name==='phi-reception-tower-hologram'&&obj.material?.isMeshBasicMaterial)){
   targets.push(obj);
  }
 });
 return targets;
}
export function createPhiPostFX(THREE,renderer,scene,camera){
 const samples=Object.fromEntries(PHI_FX_PRESETS.map(name=>[name,[]]));
 const stats=window.__phiPostFX={preset:'original',active:false,errors:[],
  frames:samples,summaries:{},selectedGlowMeshes:0,focusActive:false,renderer:'original'};
 let composer=null,preset='original',selection=null,dofPass=null,dof=null;
 let previous=0,lastMode='',lastUI=0,lastGlowScan=0,selectedIds='';
 const box=document.createElement('div');box.id='phi-post-fx';
 box.style.cssText='position:fixed;right:10px;bottom:80px;z-index:42;display:flex;align-items:center;gap:8px;padding:7px 9px;background:#f0ece3ee;color:#253d48;border:1px solid #827a6a;border-radius:5px;font:12px/1.35 system-ui;max-width:calc(100vw - 20px)';
 const label=document.createElement('label');label.textContent='Image treatment ';
 const select=document.createElement('select');select.id='phi-post-fx-preset';
 select.setAttribute('aria-label','Gallery rendering treatment');
 select.style.cssText='background:#304554;color:white;border:1px solid #304554;border-radius:3px;padding:6px;font:inherit;cursor:pointer';
 for(const [value,title] of [
  ['original','Original'],['architectural','Architectural'],
  ['luminous','Luminous'],['photographic','Photographic']
 ]){const item=document.createElement('option');item.value=value;item.textContent=title;select.append(item);}
 label.append(select);
 const report=document.createElement('span');report.style.whiteSpace='nowrap';
 report.textContent='Compare effects';
 box.append(label,report);document.body.append(box);
 const scanGlow=()=>{
  if(!selection)return;
  const found=phiGlowTargets(scene),ids=found.map(o=>o.id).join(',');
  if(ids!==selectedIds){selection.set(found);selectedIds=ids;}
  stats.selectedGlowMeshes=found.length;
 };
 function build(mode){
  const next=new EffectComposer(renderer,{frameBufferType:THREE.HalfFloatType,multisampling:0});
  next.addPass(new RenderPass(scene,camera));
  let newSelection=null,newDOF=null,newDOFPass=null;
  if(mode==='architectural'){
   // Low-resolution contact depth; deliberately restrained to avoid the old AO cost.
   next.addPass(new EffectPass(camera,new SSAOEffect(camera,null,{
    samples:6,rings:5,resolutionScale:.5,intensity:.14,radius:.035,
    bias:.035,fade:.03,luminanceInfluence:.75
   })));
   next.addPass(new EffectPass(camera,
    new BrightnessContrastEffect({brightness:.006,contrast:.035}),
    new HueSaturationEffect({saturation:-.018}),
    new BloomEffect({intensity:.08,luminanceThreshold:.94,luminanceSmoothing:.06,mipmapBlur:true,levels:4}),
    new VignetteEffect({eskil:false,offset:.44,darkness:.13})
   ));
  }else if(mode==='luminous'){
   const bloom=new SelectiveBloomEffect(scene,camera,{
    intensity:.64,luminanceThreshold:.34,luminanceSmoothing:.12,
    mipmapBlur:true,levels:4,radius:.50
   });
   bloom.ignoreBackground=true;
   newSelection=bloom.selection;
   next.addPass(new EffectPass(camera,bloom));
   next.addPass(new EffectPass(camera,new VignetteEffect({
    eskil:false,offset:.44,darkness:.10
   })));
  }else if(mode==='photographic'){
   // No depth blur while walking. Only inspecting a nearby artwork enables it.
   newDOF=new DepthOfFieldEffect(camera,{
    focusDistance:3,focusRange:2.0,bokehScale:1.15,resolutionScale:.5
   });
   newDOFPass=new EffectPass(camera,newDOF);
   newDOFPass.enabled=false;
   next.addPass(newDOFPass);
   const grain=new NoiseEffect({premultiply:false});
   grain.blendMode.opacity.value=.017;
   next.addPass(new EffectPass(camera,grain,
    new VignetteEffect({eskil:false,offset:.45,darkness:.14})));
  }
  // The live renderer uses Neutral tone mapping; do not silently select AgX.
  next.addPass(new EffectPass(camera,new ToneMappingEffect({mode:ToneMappingMode.NEUTRAL})));
  next.setSize(innerWidth,innerHeight,false);
  return {next,newSelection,newDOF,newDOFPass};
 }
 function labelStatus(){
  select.value=preset;
  const d=stats.summaries[preset];
  const slow=d&&stats.summaries.original&&
   d.p95>Math.max(50,stats.summaries.original.p95*1.4);
  const extra=preset==='luminous'?' · '+stats.selectedGlowMeshes+' glow meshes':
   preset==='photographic'?(stats.focusActive?' · artwork in focus':' · sharp while walking'):'';
  report.textContent=stats.errors.length?'FX unavailable; original renderer':
   (d?d.median+' ms · p95 '+d.p95+' ms'+(slow?' · slower':''):'Collecting frames…')+extra;
 }
 function setPreset(name){
  if(!PHI_FX_PRESETS.includes(name)||renderer?.xr?.isPresenting)return false;
  if(preset===name){labelStatus();return true;}
  let replacement=null;
  try{if(name!=='original')replacement=build(name);}
  catch(error){
   stats.errors.push(String(error));console.warn('[3D gallery post FX] preset unavailable',name,error);
   renderer.setRenderTarget(null);renderer.autoClear=true;
   labelStatus();return false;
  }
  selection?.clear();
  composer?.dispose();
  composer=replacement?.next||null;
  selection=replacement?.newSelection||null;
  dof=replacement?.newDOF||null;
  dofPass=replacement?.newDOFPass||null;
  selectedIds='';lastGlowScan=0;
  preset=name;stats.preset=name;stats.active=name!=='original';
  stats.renderer=name==='original'?'original':'pmndrs';
  renderer.setRenderTarget(null);renderer.autoClear=true;
  previous=0;lastMode='';stats.focusActive=false;
  if(selection)scanGlow();
  labelStatus();return true;
 }
 select.addEventListener('change',()=>{if(!setPreset(select.value))select.value=preset;});
 function render(dt,focus=null){
  if(!renderer)return;
  const inXR=renderer.xr.isPresenting;
  const mode=!inXR&&composer?preset:'original';
  const now=performance.now();
  if(previous&&lastMode===mode&&!document.hidden){
   const elapsed=now-previous;
   if(elapsed>0&&elapsed<1000){const group=samples[mode];group.push(elapsed);if(group.length>240)group.shift();}
  }
  previous=now;lastMode=mode;
  if(selection&&now-lastGlowScan>1600){scanGlow();lastGlowScan=now;}
  if(dofPass){
   const active=!!focus&&!inXR;
   dofPass.enabled=active;stats.focusActive=active;
   if(active){if(!dof.target)dof.target=new THREE.Vector3();dof.target.copy(focus);}
  }else stats.focusActive=false;
  try{
   if(mode==='original'){renderer.autoClear=true;renderer.render(scene,camera);}
   else {renderer.autoClear=false;composer.render(dt);renderer.autoClear=true;}
  }catch(error){
   console.warn('[3D gallery post FX] render fallback',error);
   stats.errors.push(String(error));
   selection?.clear();composer?.dispose();selection=null;composer=null;dof=null;dofPass=null;
   preset='original';stats.preset='original';stats.active=false;
   renderer.setRenderTarget(null);renderer.autoClear=true;renderer.render(scene,camera);
  }
  if(now-lastUI>1400){
   for(const type of PHI_FX_PRESETS)stats.summaries[type]=phiFXSummary(samples[type]);
   stats.pixelRatio=renderer.getPixelRatio();stats.drawCalls=renderer.info.render.calls;
   stats.frameCPUms=+(performance.now()-now).toFixed(2);
   labelStatus();lastUI=now;
  }
 }
 function resize(w,h){composer?.setSize(w,h,false);}
 document.addEventListener('visibilitychange',()=>{previous=0;});
 const initial=new URLSearchParams(location.search).get('fx');
 if(initial==='on')setPreset('architectural');
 else if(PHI_FX_PRESETS.includes(initial))setPreset(initial);
 else labelStatus();
 return {render,resize,setPreset,stats};
}
