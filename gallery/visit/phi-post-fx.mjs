// Test-gallery-only pmndrs postprocessing; opt-in and safe to bypass in VR.
import {EffectComposer,RenderPass,EffectPass,BloomEffect,VignetteEffect} from 'postprocessing';
export function createPhiPostFX(THREE,renderer,scene,camera){
 const stats=window.__phiPostFX={active:false,errors:[],frames:{on:[],off:[]}};
 let composer=null,active=false,previous=0,modeLast='',lastUI=0;
 const host=document.createElement('div');host.id='phi-post-fx';
 host.style.cssText='position:fixed;right:10px;bottom:80px;z-index:42;display:flex;align-items:center;gap:8px;padding:8px;background:#f0ece3f2;color:#253d48;border:1px solid #827a6a;border-radius:5px;font:12px system-ui';
 const button=document.createElement('button');button.type='button';
 button.style.cssText='padding:7px 10px;background:#304554;color:#fff;border:none;border-radius:4px;cursor:pointer';
 button.setAttribute('aria-label','Toggle experimental post-processing');
 const label=document.createElement('span');label.textContent='Bloom + vignette';
 host.append(button,label);document.body.append(host);
 const summary=arr=>{if(arr.length<20)return null;const s=[...arr].sort((a,b)=>a-b);
  return [s[Math.floor(s.length/2)].toFixed(1),s[Math.floor(s.length*.95)].toFixed(1)];};
 function report(){
  button.textContent='Post FX · '+(active?'On':'Off');button.setAttribute('aria-pressed',String(active));
  const s=summary(stats.frames[active?'on':'off']);
  label.textContent=stats.errors.length?'FX failed; original renderer':s?'Frame '+s[0]+' / p95 '+s[1]+' ms':'Bloom + vignette';
 }
 function activate(on){
  if(renderer?.xr?.isPresenting)return;
  try{
   if(on&&!composer){
    composer=new EffectComposer(renderer,{frameBufferType:THREE.HalfFloatType,multisampling:0});
    composer.addPass(new RenderPass(scene,camera));
    composer.addPass(new EffectPass(camera,
     new BloomEffect({intensity:.16,luminanceThreshold:.92,luminanceSmoothing:.07,mipmapBlur:true,levels:4,radius:.48}),
     new VignetteEffect({eskil:false,offset:.38,darkness:.22})));
    composer.setSize(innerWidth,innerHeight,false);
   }
   active=on;stats.active=on;renderer.autoClear=!on;
  }catch(e){stats.errors.push(String(e));active=false;stats.active=false;
   renderer.setRenderTarget(null);renderer.autoClear=true;console.warn('PostFX init fallback',e);}
  previous=0;modeLast='';report();
 }
 button.addEventListener('click',()=>activate(!active));
 function render(dt){
  if(!renderer)return;
  const on=active&&!renderer.xr.isPresenting&&!stats.errors.length;
  const mode=on?'on':'off',time=performance.now();
  if(previous&&modeLast===mode&&!document.hidden){
   const elapsed=time-previous;if(elapsed>0&&elapsed<1000){const a=stats.frames[mode];a.push(elapsed);if(a.length>180)a.shift();}
  }
  previous=time;modeLast=mode;
  try{if(on){renderer.autoClear=false;composer.render(dt);}
   else{renderer.autoClear=true;renderer.render(scene,camera);}}
  catch(e){stats.errors.push(String(e));active=false;stats.active=false;
   renderer.setRenderTarget(null);renderer.autoClear=true;renderer.render(scene,camera);report();}
  if(time-lastUI>1200){stats.pixelRatio=renderer.getPixelRatio();report();lastUI=time;}
 }
 function resize(w,h){composer?.setSize(w,h,false);}
 document.addEventListener('visibilitychange',()=>{previous=0;});
 if(new URLSearchParams(location.search).get('fx')==='on'&&!matchMedia('(pointer:coarse)').matches)activate(true);else report();
 return {render,resize,activate,stats};
}
