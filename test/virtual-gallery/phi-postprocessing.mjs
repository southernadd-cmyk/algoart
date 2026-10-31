import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {createPhiShadows} from './phi-shadows.mjs';

const MODES=['off','composer','ao','fxaa','ao-fxaa'];
export function summariseFrames(samples){
 if(!samples.length)return {median:0,p95:0,p99:0,over50:0,over180:0,count:0};
 const ordered=[...samples].sort((a,b)=>a-b);
 const percentile=p=>+ordered[Math.min(ordered.length-1,Math.floor(ordered.length*p))].toFixed(2);
 return {median:percentile(.5),p95:percentile(.95),p99:percentile(.99),
  over50:samples.filter(ms=>ms>50).length,over180:samples.filter(ms=>ms>180).length,count:samples.length};
}

export function createPhiPostTest({THREE,renderer,scene,camera}){
 const params=new URLSearchParams(location.search);
 const requested=params.get('post');
 const mode=MODES.includes(requested)?requested:'off';
 const useAO=mode.includes('ao'),useFXAA=mode.includes('fxaa');
 const shadows=params.get('shadows')==='1'?createPhiShadows({THREE,renderer,scene,camera,lowPower:matchMedia('(pointer:coarse)').matches}):null;
 const stats=window.__phiPostTest={revision:'post-test-1',mode,ready:false,frames:[],gpuMs:[],
  startupReadyMs:null,warmMs:null,targetBytesEstimate:0,gpuSupported:false,error:null};
 let composer,ao,fxaa,maskTarget,ready=false,failed=false,lastFrame=0,lastUI=0;
 let activeQuery=null,pendingQueries=[];
 const gl=renderer.getContext(),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 stats.gpuSupported=!!timer;
 stats.shadows=shadows?.stats||{enabled:false};
 const panel=document.createElement('details');panel.id='phi-post-test';
 panel.style.cssText='position:fixed;right:8px;bottom:8px;z-index:110;max-width:310px;background:#f5f0e6ed;color:#222;padding:8px 10px;font:12px/1.4 system-ui;border:1px solid #888;border-radius:5px';
 const summary=document.createElement('summary');summary.textContent='Visual test · '+mode;panel.append(summary);
 const label=document.createElement('label');label.textContent='Rendering comparison ';
 const select=document.createElement('select');select.setAttribute('aria-label','Rendering comparison');
 for(const value of MODES){const option=document.createElement('option');option.value=value;option.textContent={off:'Original renderer',composer:'Composer only',ao:'Subtle ambient occlusion',fxaa:'FXAA only','ao-fxaa':'Ambient occlusion + FXAA'}[value];select.append(option);}
 select.value=mode;select.addEventListener('change',()=>{const url=new URL(location.href);url.searchParams.set('post',select.value);location.assign(url.href);});
 label.append(select);panel.append(label);
 const shadowLabel=document.createElement('label');shadowLabel.style.display='block';
 const shadowToggle=document.createElement('input');shadowToggle.type='checkbox';shadowToggle.checked=!!shadows;
 shadowToggle.setAttribute('aria-label','Enable cast shadows');
 shadowToggle.addEventListener('change',()=>{const url=new URL(location.href);url.searchParams.set('shadows',shadowToggle.checked?'1':'0');location.assign(url.href);});
 shadowLabel.append(shadowToggle,' Cast shadows (test)');panel.append(shadowLabel);
 const reset=document.createElement('button');reset.type='button';reset.textContent='Restart measurement';
 reset.addEventListener('click',()=>{stats.frames.length=0;stats.gpuMs.length=0;lastFrame=0;});panel.append(reset);
 const report=document.createElement('p');report.style.marginBottom='0';report.textContent='Preparing comparison…';panel.append(report);
 const note=document.createElement('small');note.textContent='Test only. Same scene and pixel density. Changing mode reloads the gallery.';panel.append(note);document.body.append(panel);
 const maskWhite=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false,side:THREE.DoubleSide});
 const maskBlack=new THREE.MeshBasicMaterial({color:0x000000,toneMapped:false,side:THREE.DoubleSide});
 const maskClear=new THREE.Color();
 function hiddenFromAO(object){
  const materials=[].concat(object.material||[]);
  return object.isReflector||materials.some(m=>m.transparent&&!m.depthWrite)||object.name==='phi-spiral-reflecting-water';
 }
 function renderProtectionMask(){
  const saved=[],oldBackground=scene.background,oldOverride=scene.overrideMaterial;
  const target=renderer.getRenderTarget(),alpha=renderer.getClearAlpha();renderer.getClearColor(maskClear);
  const shadowRefresh=renderer.shadowMap.needsUpdate;
  try{
   // Shadow depth must use the original alpha-tested model materials, never
   // this black/white protection mask. RenderPass refreshes it afterwards.
   renderer.shadowMap.needsUpdate=false;
   scene.background=null;scene.overrideMaterial=null;
   scene.traverse(o=>{
    if(!o.isMesh&&!o.isLine&&!o.isPoints)return;
    saved.push([o,o.material,o.visible]);
    if(!o.isMesh||hiddenFromAO(o)){o.visible=false;return;}
    // Protect unlit painting faces and signs from any AO multiplication.
    o.material=[].concat(o.material||[]).every(m=>m.isMeshBasicMaterial)?maskWhite:maskBlack;
   });
   renderer.setRenderTarget(maskTarget);renderer.setClearColor(0x000000,1);renderer.clear();renderer.render(scene,camera);
  }finally{
   for(const [o,material,visible] of saved){o.material=material;o.visible=visible;}
   scene.background=oldBackground;scene.overrideMaterial=oldOverride;
   renderer.setRenderTarget(target);renderer.setClearColor(maskClear,alpha);
   renderer.shadowMap.needsUpdate=shadowRefresh;
  }
 }
 function initialise(){
  if(mode==='off')return;
  composer=new EffectComposer(renderer);
  // Canvas MSAA does not antialias an offscreen target. Retain a matching
  // multisampled scene target unless explicitly comparing FXAA instead.
  const samples=useFXAA?0:Math.min(4,renderer.capabilities.maxSamples);
  composer.renderTarget1.samples=samples;composer.renderTarget2.samples=samples;
  composer.addPass(new RenderPass(scene,camera));
  if(useAO){
   ao=new GTAOPass(scene,camera);ao.blendIntensity=.28;
   ao.updateGtaoMaterial({radius:.35,thickness:.12,distanceExponent:2,distanceFallOff:1,samples:8,screenSpaceRadius:false});
   ao.updatePdMaterial({samples:8,radius:4});
   const originalSize=ao.setSize.bind(ao);
   ao.setSize=(w,h)=>originalSize(Math.max(1,Math.round(w*.5)),Math.max(1,Math.round(h*.5)));
   // Never render the Reflector's recursive scene pass into the normal buffer.
   const hide=ao._overrideVisibility.bind(ao);
   ao._overrideVisibility=()=>{hide();scene.traverse(o=>{if(o.visible&&hiddenFromAO(o)){o.visible=false;ao._visibilityCache.push(o);}});};
   const restore=ao._restoreVisibility.bind(ao),renderAO=ao.render.bind(ao);
   ao.render=(...args)=>{try{return renderAO(...args);}finally{restore();scene.overrideMaterial=null;}};
   maskTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.UnsignedByteType});
   ao.blendMaterial.uniforms.tProtection={value:maskTarget.texture};
   // Mix AO back to white on unlit artwork, preserving its input colour.
   const blend=ao.blendMaterial.fragmentShader;
   if(!/texture2D\(\s*tDiffuse\s*,\s*vUv\s*\)/.test(blend))throw new Error('Unsupported GTAO composite shader');
   ao.blendMaterial.fragmentShader=blend
    .replace('void main()', 'uniform sampler2D tProtection;\nvoid main()')
    .replace(/texture2D\(\s*tDiffuse\s*,\s*vUv\s*\)/g,
     'mix(texture2D(tDiffuse, vUv), vec4(1.0), texture2D(tProtection, vUv).r)');
   composer.addPass(ao);
  }
  composer.addPass(new OutputPass());
  if(useFXAA){fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);}
  resize();
 }
 function resize(){
  if(!composer)return;
  composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);
  const width=Math.round(innerWidth*renderer.getPixelRatio()),height=Math.round(innerHeight*renderer.getPixelRatio());
  maskTarget?.setSize(width,height);fxaa?.uniforms.resolution.value.set(1/width,1/height);
  // Estimate owned colour/depth storage, not total driver/GPU memory.
  const sceneSamples=composer.renderTarget1.samples;
  stats.targetBytesEstimate=width*height*(24+(sceneSamples?24*sceneSamples:0)+(useAO?8+9:0));
 }
 function draw(){
  if(!composer||renderer.xr.isPresenting){renderer.render(scene,camera);return;}
  if(useAO)renderProtectionMask();
  composer.render();
 }
 function pollGPU(){
  if(!timer)return;
  const disjoint=gl.getParameter(timer.GPU_DISJOINT_EXT);
  pendingQueries=pendingQueries.filter(q=>{
   if(disjoint){gl.deleteQuery(q);return false;}
   if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))return true;
   stats.gpuMs.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);if(stats.gpuMs.length>180)stats.gpuMs.shift();gl.deleteQuery(q);return false;
  });
 }
 function render(){
  const now=performance.now();
  shadows?.update(now);
  if(!document.hidden&&ready){if(lastFrame)stats.frames.push(now-lastFrame);if(stats.frames.length>600)stats.frames.shift();lastFrame=now;}
  else lastFrame=0;
  pollGPU();renderer.info.autoReset=false;renderer.info.reset();
  if(timer&&ready&&!renderer.xr.isPresenting&&pendingQueries.length<4){activeQuery=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,activeQuery);}
  try{if(ready&&!failed)draw();else renderer.render(scene,camera);}
  catch(error){failed=true;stats.error=error.message;renderer.setRenderTarget(null);renderer.render(scene,camera);console.error('[Post test] Falling back to original renderer',error);}
  finally{if(activeQuery){gl.endQuery(timer.TIME_ELAPSED_EXT);pendingQueries.push(activeQuery);activeQuery=null;}}
  if(now-lastUI>1000){
   const frames=summariseFrames(stats.frames),gpu=summariseFrames(stats.gpuMs);
   Object.assign(stats,{summary:frames,gpu:gpu,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,pixelRatio:renderer.getPixelRatio()});
   report.textContent=stats.error?'Original renderer fallback: '+stats.error:
    `Frame median ${frames.median} ms · p95 ${frames.p95} ms · p99 ${frames.p99} ms. Stalls >50 ms: ${frames.over50}; >180 ms: ${frames.over180}. GPU ${timer?gpu.median+' ms':'timing unavailable'}. Targets ≈${(stats.targetBytesEstimate/1048576).toFixed(1)} MiB.`;
   lastUI=now;
  }
 }
 async function warm(){
  if(ready)return;
  const started=performance.now();
  try{shadows?.update();initialise();draw();await new Promise(resolve=>requestAnimationFrame(resolve));draw();}
  catch(error){failed=true;stats.error=error.message;renderer.setRenderTarget(null);console.error('[Post test] Warm-up failed',error);}
  ready=true;stats.ready=true;stats.warmMs=performance.now()-started;stats.startupReadyMs=performance.now();lastFrame=0;
 }
 document.addEventListener('visibilitychange',()=>{lastFrame=0;});
 document.getElementById('enter')?.addEventListener('click',()=>{stats.frames.length=0;stats.gpuMs.length=0;lastFrame=0;});
 return {render,resize,warm,editionChanged(elevation){shadows?.editionChanged(elevation);}};
}
