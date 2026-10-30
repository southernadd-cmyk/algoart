// Test-tower post-processing lab. No changes to the live renderer or phi lights.
import {
 EffectComposer,RenderPass,NormalPass,EffectPass,BloomEffect,SelectiveBloomEffect,
 SSAOEffect,BrightnessContrastEffect,HueSaturationEffect,VignetteEffect,
 NoiseEffect,DepthOfFieldEffect,ToneMappingEffect,ToneMappingMode
} from 'postprocessing';

export const PHI_FX_PRESETS=Object.freeze(['original','architectural','luminous','photographic']);
export const PHI_FX_CONTROLS=Object.freeze([
 {section:'Colour',key:'brightness',label:'Brightness',min:-.4,max:.4,step:.01},
 {section:'Colour',key:'contrast',label:'Contrast',min:-.5,max:.8,step:.01},
 {section:'Colour',key:'saturation',label:'Saturation',min:-1,max:1,step:.01},
 {section:'Bloom',key:'bloomIntensity',label:'Bloom strength',min:0,max:5,step:.05},
 {section:'Bloom',key:'bloomThreshold',label:'Glow threshold',min:0,max:2,step:.025},
 {section:'Bloom',key:'bloomRadius',label:'Glow spread',min:0,max:1.5,step:.025},
 {section:'Depth',key:'aoIntensity',label:'Contact shadow strength',min:0,max:4,step:.05},
 {section:'Depth',key:'aoRadius',label:'Contact shadow radius',min:.01,max:.75,step:.01},
 {section:'Atmosphere',key:'vignette',label:'Edge darkening',min:0,max:1.5,step:.025},
 {section:'Atmosphere',key:'vignetteOffset',label:'Vignette coverage',min:0,max:1,step:.025},
 {section:'Atmosphere',key:'grain',label:'Film grain',min:0,max:.4,step:.01},
 {section:'Focus',key:'bokeh',label:'Background blur',min:0,max:8,step:.1},
 {section:'Focus',key:'focusRange',label:'Focus range (m)',min:.1,max:8,step:.1}
]);
export const PHI_FX_DEFAULTS=Object.freeze({
 architectural:{brightness:.02,contrast:.14,saturation:-.08,bloomIntensity:1.1,bloomThreshold:.58,bloomRadius:.72,
  aoIntensity:1.2,aoRadius:.22,vignette:.30,vignetteOffset:.48,grain:.015,bokeh:2,focusRange:1.8,glowMode:'all',dofMode:'off',aoSamples:6},
 luminous:{brightness:.02,contrast:.10,saturation:.08,bloomIntensity:2.4,bloomThreshold:.20,bloomRadius:.85,
  aoIntensity:.1,aoRadius:.16,vignette:.20,vignetteOffset:.46,grain:.02,bokeh:2,focusRange:1.8,glowMode:'installations',dofMode:'off',aoSamples:6},
 photographic:{brightness:.01,contrast:.16,saturation:-.03,bloomIntensity:.6,bloomThreshold:.65,bloomRadius:.70,
  aoIntensity:.55,aoRadius:.18,vignette:.36,vignetteOffset:.52,grain:.08,bokeh:3.2,focusRange:1.4,
  glowMode:'all',dofMode:'inspection',aoSamples:6}
});
export function phiFXSettings(preset,values={}){
 if(!Object.prototype.hasOwnProperty.call(PHI_FX_DEFAULTS,preset))throw Error('Unknown post FX preset');
 const out={...PHI_FX_DEFAULTS[preset]};
 for(const control of PHI_FX_CONTROLS){
  const value=Number(values[control.key]);
  if(values[control.key]!==undefined&&Number.isFinite(value)){
   const steps=Math.round((Math.min(control.max,Math.max(control.min,value))-control.min)/control.step);
   out[control.key]=+Math.min(control.max,control.min+steps*control.step).toFixed(4);
  }
 }
 if(['off','all','installations'].includes(values.glowMode))out.glowMode=values.glowMode;
 if(['off','inspection','preview'].includes(values.dofMode))out.dofMode=values.dofMode;
 if([4,6,8,12,16].includes(Number(values.aoSamples)))out.aoSamples=Number(values.aoSamples);
 return out;
}
export function phiFXExport(preset,settings,metrics={}){
 return JSON.stringify({
  project:'PROPORTION PIECE',type:'test-gallery-post-processing',version:2,
  preset,values:phiFXSettings(preset,settings),
  performance:metrics
 },null,2);
}
export function phiFXSummary(samples){
 if(samples.length<20)return null;
 const s=[...samples].sort((a,b)=>a-b);
 return {median:+s[Math.floor(s.length*.5)].toFixed(1),p95:+s[Math.floor(s.length*.95)].toFixed(1),
  stalls:s.filter(ms=>ms>50).length,count:s.length};
}
const glowRoots=new Set(['phi-reception-tower-hologram','phi-reception-three-living-monitors',
 'phi-reception-monitor-bank-two','phi-reception-two-large-rear-wall-monitors']);
const glowFaces=new Set(['monitor-screen','large-monitor-video-pane','recursive-smallest-video-mosaic',
 'hologram-lift-shaft','hologram-projector-base']);
export function phiGlowTargets(scene){
 const out=[];
 scene.traverse(object=>{
  if(!object.isMesh&&!object.isLineSegments)return;
  let group=object.parent,within=false;
  while(group&&group!==scene){if(glowRoots.has(group.name)){within=true;break;}group=group.parent;}
  if(within&&(glowFaces.has(object.name)||(object.isLineSegments&&object.name==='hologram-architectural-edges')||
   (object.isMesh&&group?.name==='phi-reception-tower-hologram'&&object.material?.isMeshBasicMaterial)))out.push(object);
 });
 return out;
}

export function createPhiPostFX(THREE,renderer,scene,camera){
 const frames=Object.fromEntries(PHI_FX_PRESETS.map(p=>[p,[]]));
 const settings=Object.fromEntries(Object.keys(PHI_FX_DEFAULTS).map(p=>[p,phiFXSettings(p)]));
 const stats=window.__phiPostFX={preset:'original',active:false,errors:[],frames,summaries:{},
  selectedGlowMeshes:0,focusActive:false,settings,renderer:'original'};
 let preset='original',bypass=false,composer=null,effects=null,selection=null,dofPass=null;
 let previous=0,lastMode='',lastUI=0,lastGlowScan=0,selectedIds='';
 // A small, collapsible workshop: all sliders are native, keyboard-accessible and live.
 const panel=document.createElement('details');panel.id='phi-post-fx';panel.open=true;
 panel.style.cssText='position:fixed;right:12px;top:110px;z-index:80;width:min(340px,calc(100vw - 24px));max-height:calc(100dvh - 135px);overflow:auto;background:#f0ece5f5;color:#263b42;border:1px solid #827964;border-radius:6px;box-shadow:0 5px 24px #1b26252b;font:12px/1.45 system-ui,sans-serif';
 const title=document.createElement('summary');title.textContent='Post-processing lab · test only';
 title.style.cssText='cursor:pointer;padding:10px 12px;font-weight:650;font-size:14px;background:#e0d9cb;position:sticky;top:0;z-index:1';
 panel.append(title);
 const body=document.createElement('div');body.style.cssText='padding:10px 12px;display:grid;gap:9px';panel.append(body);
 const small=(tag,content,css)=>{const e=document.createElement(tag);if(content!==undefined)e.textContent=content;if(css)e.style.cssText=css;return e;};
 const presetRow=small('label','Treatment','display:grid;gap:4px;font-weight:600');
 const presetSelect=document.createElement('select');presetSelect.id='phi-post-fx-preset';
 presetSelect.setAttribute('aria-label','Gallery rendering treatment');
 presetSelect.style.cssText='padding:8px;border:1px solid #697a79;border-radius:3px;background:#fff;color:#243943';
 for(const [id,label] of [['original','Original (unprocessed)'],['architectural','Architectural'],
  ['luminous','Luminous'],['photographic','Photographic']]){
  const opt=document.createElement('option');opt.value=id;opt.textContent=label;presetSelect.append(opt);
 }
 presetRow.append(presetSelect);body.append(presetRow);
 const actions=small('div',undefined,'display:flex;gap:6px;flex-wrap:wrap');
 const controlButton=(label)=>{const b=small('button',label,'cursor:pointer;padding:7px 9px;border:1px solid #586d72;border-radius:3px;background:#304554;color:white;font:inherit');b.type='button';return b;};
 const compare=controlButton('Show original'),reset=controlButton('Reset preset');
 actions.append(compare,reset);body.append(actions);
 const help=small('p','Press Esc to unlock the mouse, then adjust sliders. Changes apply immediately; Original is the unprocessed comparison.',
  'margin:0;color:#58656a;font-size:11px');
 body.append(help);
 const controlsWrap=small('div',undefined,'display:grid;gap:9px');
 body.append(controlsWrap);
 const selectors=small('div',undefined,'display:grid;gap:7px');
 const makeSelect=(labelText,key,items)=>{
  const label=small('label',labelText,'display:grid;gap:4px;font-weight:600');
  const input=document.createElement('select');input.style.cssText='padding:5px;background:white;color:#243943;border:1px solid #a9a297;border-radius:3px';
  for(const [value,name] of items){const o=document.createElement('option');o.value=value;o.textContent=name;input.append(o);}
  input.addEventListener('change',()=>{if(preset==='original')return;settings[preset][key]=key==='aoSamples'?Number(input.value):input.value;apply();});
  label.append(input);selectors.append(label);return input;
 };
 const glowSelect=makeSelect('Glow target','glowMode',[['off','None'],['all','Entire scene'],['installations','Hologram & installations only']]);
 const dofSelect=makeSelect('Depth of field','dofMode',[['off','Off'],['inspection','Only when inspecting artwork'],['preview','Preview throughout the room']]);
 const samplesSelect=makeSelect('AO samples (higher = slower)','aoSamples',[[4,'4 — fast'],[6,'6 — balanced'],[8,'8 — detailed'],[12,'12 — high'],[16,'16 — maximum']].map(([v,t])=>[String(v),t]));
 controlsWrap.append(selectors);
 const inputs=new Map(),outputs=new Map();
 for(const spec of PHI_FX_CONTROLS){
  let section=controlsWrap.querySelector('[data-section="'+spec.section+'"]');
  if(!section){
   section=document.createElement('fieldset');section.dataset.section=spec.section;
   section.style.cssText='margin:0;padding:7px 9px 9px;border:1px solid #c5bdaf;border-radius:4px;display:grid;gap:5px;min-width:0';
   const legend=small('legend',spec.section,'padding:0 4px;font-weight:650;color:#42545b');
   section.append(legend);controlsWrap.append(section);
  }
  const row=small('label',undefined,'display:grid;gap:3px');
  const head=small('span',undefined,'display:flex;justify-content:space-between;gap:6px');
  head.append(small('span',spec.label));
  const value=small('output','','font-variant-numeric:tabular-nums;font-weight:700;color:#304554');
  head.append(value);row.append(head);
  const slider=document.createElement('input');slider.type='range';slider.min=String(spec.min);slider.max=String(spec.max);slider.step=String(spec.step);
  slider.setAttribute('aria-label',spec.label);slider.style.cssText='width:100%;accent-color:#45677a;margin:0;cursor:pointer';
  slider.addEventListener('input',()=>{
   if(preset==='original')return;
   settings[preset][spec.key]=Number(slider.value);value.textContent=Number(slider.value).toFixed(spec.step<.01?3:2);
   apply(); // Uniforms updated without rebuilding the composer or reloading.
  });
  row.append(slider);section.append(row);inputs.set(spec.key,slider);outputs.set(spec.key,value);
 }
 const timing=small('p','Frame measurements appear here.', 'margin:0;color:#344950;font-variant-numeric:tabular-nums');
 body.append(timing);
 const exportRow=small('div',undefined,'display:flex;flex-wrap:wrap;gap:6px');
 const copy=controlButton('Copy settings JSON'),show=controlButton('Show JSON');
 exportRow.append(copy,show);body.append(exportRow);
 const exportBox=document.createElement('textarea');exportBox.rows=9;exportBox.readOnly=true;
 exportBox.setAttribute('aria-label','Post-processing settings JSON for ChatGPT');
 exportBox.style.cssText='width:100%;box-sizing:border-box;resize:vertical;font:11px/1.4 monospace;border:1px solid #9d9b96;border-radius:3px;padding:6px;background:#fff;color:#20343b';
 exportBox.hidden=true;body.append(exportBox);
 const message=small('div','','font-size:11px;color:#526269');message.setAttribute('role','status');body.append(message);
 document.body.append(panel);
 function sync(){
  presetSelect.value=preset;
  const visible=preset!=='original';
  controlsWrap.hidden=!visible;reset.disabled=!visible;compare.disabled=!visible;
  compare.textContent=bypass?'Reapply effects':'Show original';
  if(!visible)return;
  const cfg=settings[preset];
  for(const spec of PHI_FX_CONTROLS){
   inputs.get(spec.key).value=String(cfg[spec.key]);
   outputs.get(spec.key).textContent=Number(cfg[spec.key]).toFixed(spec.step<.01?3:2);
  }
  glowSelect.value=cfg.glowMode;dofSelect.value=cfg.dofMode;samplesSelect.value=String(cfg.aoSamples);
 }
 const scanGlow=()=>{
  if(!selection)return;
  const found=phiGlowTargets(scene),ids=found.map(o=>o.id).join(',');
  if(ids!==selectedIds){selection.set(found);selectedIds=ids;}
  stats.selectedGlowMeshes=found.length;
 };
 function build(){
  const compositor=new EffectComposer(renderer,{frameBufferType:THREE.HalfFloatType,multisampling:0});
  compositor.addPass(new RenderPass(scene,camera));
  // Normal pass corrects the missing normal-buffer setup in the earlier AO experiment.
  const normals=new NormalPass(scene,camera,{resolutionScale:.5});
  const ao=new SSAOEffect(camera,normals.texture,{samples:6,rings:6,resolutionScale:.5,intensity:0,radius:.2});
  const aoPass=new EffectPass(camera,ao);
  compositor.addPass(normals);compositor.addPass(aoPass);
  const fullBloom=new BloomEffect({mipmapBlur:true,levels:4,intensity:0,luminanceThreshold:.5,radius:.7});
  const fullPass=new EffectPass(camera,fullBloom);compositor.addPass(fullPass);
  const selectedBloom=new SelectiveBloomEffect(scene,camera,{mipmapBlur:true,levels:4,
   intensity:0,luminanceThreshold:.25,radius:.8});
  selectedBloom.ignoreBackground=true;
  const selectedPass=new EffectPass(camera,selectedBloom);compositor.addPass(selectedPass);
  const dof=new DepthOfFieldEffect(camera,{focusDistance:3,focusRange:1.5,bokehScale:2,resolutionScale:.5});
  const focusPass=new EffectPass(camera,dof);compositor.addPass(focusPass);
  const colour=new BrightnessContrastEffect(),sat=new HueSaturationEffect();
  const vignette=new VignetteEffect({eskil:false}),grain=new NoiseEffect({premultiply:false});
  compositor.addPass(new EffectPass(camera,colour,sat,grain,vignette,
   new ToneMappingEffect({mode:ToneMappingMode.NEUTRAL})));
  compositor.setSize(innerWidth,innerHeight,false);
  // Until explicitly enabled, expensive depth and bloom passes stay dormant.
  normals.enabled=false;aoPass.enabled=false;fullPass.enabled=false;
  selectedPass.enabled=false;focusPass.enabled=false;
  return {compositor,effects:{normals,ao,aoPass,fullBloom,fullPass,selectedBloom,selectedPass,dof,focusPass,colour,sat,vignette,grain}};
 }
 function apply(){
  if(!composer||!effects||preset==='original')return;
  const s=settings[preset],e=effects;
  e.colour.brightness=s.brightness;e.colour.contrast=s.contrast;e.sat.saturation=s.saturation;
  e.vignette.darkness=s.vignette;e.vignette.offset=s.vignetteOffset;
  e.grain.blendMode.opacity.value=s.grain;
  for(const glow of [e.fullBloom,e.selectedBloom]){
   glow.intensity=s.bloomIntensity;glow.luminanceMaterial.threshold=s.bloomThreshold;
   glow.mipmapBlurPass.radius=s.bloomRadius;
  }
  e.fullPass.enabled=s.glowMode==='all'&&s.bloomIntensity>0;
  e.selectedPass.enabled=s.glowMode==='installations'&&s.bloomIntensity>0;
  e.ao.intensity=s.aoIntensity;e.ao.ssaoMaterial.radius=s.aoRadius;e.ao.samples=s.aoSamples;
  e.normals.enabled=e.aoPass.enabled=s.aoIntensity>0;
  e.dof.bokehScale=s.bokeh;e.dof.cocMaterial.focusRange=s.focusRange;
  e.focusPass.enabled=false;
  if(e.selectedPass.enabled)scanGlow();
  stats.parameters={...s};
 }
 function setPreset(next){
  if(!PHI_FX_PRESETS.includes(next)||renderer?.xr?.isPresenting)return false;
  if(next!=='original'&&!composer){
   try{const built=build();composer=built.compositor;effects=built.effects;selection=effects.selectedBloom.selection;}
   catch(error){stats.errors.push(String(error));console.warn('[FX lab] compositor failed',error);
    renderer.setRenderTarget(null);renderer.autoClear=true;message.textContent='Effect unavailable: '+String(error);return false;}
  }
  preset=next;bypass=false;stats.preset=next;stats.active=next!=='original';
  stats.renderer=stats.active?'pmndrs':'original';stats.focusActive=false;
  if(next!=='original')apply();
  renderer.setRenderTarget(null);renderer.autoClear=true;
  previous=0;lastMode='';sync();return true;
 }
 presetSelect.addEventListener('change',()=>{if(!setPreset(presetSelect.value))presetSelect.value=preset;});
 compare.addEventListener('click',()=>{
  if(preset==='original'||renderer?.xr?.isPresenting)return;
  bypass=!bypass;stats.active=!bypass;renderer.setRenderTarget(null);renderer.autoClear=true;
  previous=0;lastMode='';sync();
 });
 reset.addEventListener('click',()=>{if(preset==='original')return;
  settings[preset]=phiFXSettings(preset);apply();sync();message.textContent='Preset restored.';});
 function currentJSON(){return phiFXExport(preset==='original'?'architectural':preset,
  settings[preset==='original'?'architectural':preset],
  {active:preset!=='original'&&!bypass,frames:stats.summaries[preset]||null,
   original:stats.summaries.original||null,pixelRatio:renderer.getPixelRatio(),
   selectedGlowMeshes:stats.selectedGlowMeshes});
 }
 function reveal(){exportBox.value=currentJSON();exportBox.hidden=false;exportBox.focus();exportBox.select();}
 show.addEventListener('click',()=>{reveal();message.textContent='Select and copy these values to paste into ChatGPT.';});
 copy.addEventListener('click',async()=>{
  reveal();const value=exportBox.value;
  try{
   if(!navigator.clipboard?.writeText)throw Error('Clipboard permission unavailable');
   await navigator.clipboard.writeText(value);message.textContent='Settings copied. Paste them into ChatGPT.';
  }catch(error){message.textContent='Clipboard not available. JSON is selected — press Ctrl+C or Cmd+C.';}
 });
 function render(dt,focus=null){
  if(!renderer)return;
  const on=preset!=='original'&&!bypass&&!renderer.xr.isPresenting&&!!composer;
  const mode=on?preset:'original',now=performance.now();
  if(previous&&lastMode===mode&&!document.hidden){
   const elapsed=now-previous;
   if(elapsed>0&&elapsed<1000){const bucket=frames[mode];bucket.push(elapsed);if(bucket.length>240)bucket.shift();}
  }
  previous=now;lastMode=mode;
  if(on&&effects?.selectedPass.enabled&&now-lastGlowScan>1400){scanGlow();lastGlowScan=now;}
  if(effects?.focusPass){
   const s=settings[preset],dofEnabled=on&&s&&(s.dofMode==='preview'||(s.dofMode==='inspection'&&!!focus))&&s.bokeh>0;
   effects.focusPass.enabled=!!dofEnabled;stats.focusActive=!!dofEnabled;
   if(dofEnabled&&s.dofMode==='inspection'&&focus){
    if(!effects.dof.target)effects.dof.target=new THREE.Vector3();
    effects.dof.target.copy(focus);
   }else if(effects.dof.target)effects.dof.target=null;
  }
  try{
   if(!on){renderer.autoClear=true;renderer.render(scene,camera);}
   else{renderer.autoClear=false;composer.render(dt);renderer.autoClear=true;}
  }catch(error){
   stats.errors.push(String(error));console.error('[FX lab] original renderer fallback',error);
   preset='original';bypass=false;stats.active=false;
   renderer.setRenderTarget(null);renderer.autoClear=true;
   renderer.render(scene,camera);sync();message.textContent='Post-processing error: '+String(error);
  }
  if(now-lastUI>1250){
   for(const p of PHI_FX_PRESETS)stats.summaries[p]=phiFXSummary(frames[p]);
   const value=stats.summaries[mode],base=stats.summaries.original;
   timing.textContent=(value?'Frame median '+value.median+' ms · p95 '+value.p95+' ms · >50ms '+value.stalls:
    'Gathering frame data…')+(base&&mode!=='original'?' · Original p95 '+base.p95+' ms':'')+
    (effects?.selectedPass.enabled&&on?' · glow targets '+stats.selectedGlowMeshes:'');
   stats.pixelRatio=renderer.getPixelRatio();stats.drawCalls=renderer.info.render.calls;
   lastUI=now;
  }
 }
 function resize(w,h){composer?.setSize(w,h,false);}
 document.addEventListener('visibilitychange',()=>{previous=0;});
 const requested=new URLSearchParams(location.search).get('fx');
 if(requested==='on')setPreset('architectural');
 else if(PHI_FX_PRESETS.includes(requested))setPreset(requested);
 else setPreset('original');
 return {render,resize,setPreset,stats,settings,exportSettings:currentJSON};
}
