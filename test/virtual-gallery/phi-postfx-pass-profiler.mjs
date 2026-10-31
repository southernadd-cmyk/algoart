// Staging-only, opt-in diagnostic for ?liftprofile=1.
// Leaves the composer configuration, pass enablement, shaders and pixels alone.
// Times synchronous CPU work in each actual pmndrs pass, so a render-frame spike
// can be attributed to RenderPass, N8AO or an EffectPass rather than guessed at.
import {EffectComposer} from 'postprocessing';

function passName(pass,index){
 const ctor=pass?.constructor?.name||'UnknownPass';
 const effectNames=pass?.effects?
  Array.from(pass.effects,fx=>fx?.constructor?.name||'effect').join('+'):'';
 return 'postfx-pass:'+index+':'+ctor+(effectNames?'('+effectNames+')':'');
}

export function installPhiComposerPassProfiler({enabled=false,record,now=()=>performance.now(),Composer=EffectComposer}={}){
 if(!enabled||typeof record!=='function')return {enabled:false,installed:false};
 const original=Composer?.prototype?.render;
 if(typeof original!=='function')return {enabled:true,installed:false};
 const wrapped=new WeakSet();
 let installed=false;
 try{
  Composer.prototype.render=function(...args){
   const passes=Array.isArray(this.passes)?this.passes:[];
   for(let i=0;i<passes.length;i++){
    const pass=passes[i];
    if(!pass||wrapped.has(pass)||typeof pass.render!=='function')continue;
    const call=pass.render,name=passName(pass,i);
    pass.render=function(...passArgs){
     const began=now();
     try{return call.apply(this,passArgs);}
     finally{record(name,now()-began);}
    };
    wrapped.add(pass);
   }
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
  if(installed&&Composer.prototype.render!==original){
   Composer.prototype.render=original;
  }
 }};
}
