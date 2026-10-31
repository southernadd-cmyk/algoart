// Staging-only, opt-in diagnostic for ?liftprofile=1.
// Leaves the composer configuration, pass enablement, shaders and pixels alone.
// Times synchronous CPU work in each actual pmndrs pass, so a render-frame spike
// can be attributed to RenderPass, N8AO or an EffectPass rather than guessed at.
import {EffectComposer} from 'postprocessing';

// The production composer is minified in deployed bundles, so JavaScript
// constructor.name is not a reliable identifier. Names follow the explicit
// addPass order in gallery/visit/phi-post-fx.mjs; preserve indices as well.
const STAGE_NAMES=[
 'scene-render','artwork-copy','artwork-mask','normal-prepass','ssao',
 'n8ao','full-bloom','installation-bloom','depth-of-field','colour-grading',
 'artwork-restore'
];
function passName(pass,index){
 const stable=STAGE_NAMES[index]||pass?.constructor?.name||'unknown-pass';
 return 'postfx-pass:'+index+':'+stable;
}

export function installPhiComposerPassProfiler({enabled=false,record,now=()=>performance.now(),Composer=EffectComposer}={}){
 if(!enabled||typeof record!=='function')return {enabled:false,installed:false};
 const original=Composer?.prototype?.render;
 if(typeof original!=='function')return {enabled:true,installed:false};
 const wrapped=new WeakSet();
 let installed=false,active=true;
 try{
  Composer.prototype.render=function(...args){
   const passes=Array.isArray(this.passes)?this.passes:[];
   for(let i=0;i<passes.length;i++){
    const pass=passes[i];
    if(!pass||wrapped.has(pass)||typeof pass.render!=='function')continue;
    const call=pass.render,name=passName(pass,i);
    pass.render=function(...passArgs){
     if(!active)return call.apply(this,passArgs);
     const began=now();
     try{return call.apply(this,passArgs);}
     finally{record(name,now()-began);}
    };
    wrapped.add(pass);
   }
   if(!active)return original.apply(this,args);
   const began=now();
   try{return original.apply(this,args);}
   finally{record('postfx-composer-total',now()-began);}
  };
  installed=true;
 }catch(error){
  // A diagnostic must never prevent the exhibit from rendering.
  console.warn('[Phi lift profiler] pass timing unavailable',error);
  if(Composer?.prototype?.render!==original)try{Composer.prototype.render=original;}catch{}
 }
 return {enabled:true,installed,dispose(){
  // Only restore the prototype if this exact installation remains current.
  // Already-instrumented pass wrappers are inert when the lift recorder
  // declines calls outside an active visit.
  active=false;
  if(installed&&Composer.prototype.render!==original){
   Composer.prototype.render=original;
  }
 }};
}
