// Shared accessibility preference for every TouchDesigner screen, including
// the two video atlases, their large mirrored displays and canvas previews.
// A visitor's explicit choice overrides the operating-system default for this visit.
let choice=null;
let motionQuery=null;
const listeners=new Set();

function getMotionQuery(){
 if(!motionQuery && typeof globalThis.matchMedia==='function'){
  motionQuery=globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  motionQuery.addEventListener?.('change',notify);
 }
 return motionQuery;
}

export function isTouchDesignerMotionPaused(){
 return choice===null?getMotionQuery()?.matches===true:choice;
}

function updateButton(){
 if(typeof document==='undefined'||typeof document.getElementById!=='function')return;
 const button=document.getElementById('touchDesignerMotionToggle');
 if(!button)return;
 const paused=isTouchDesignerMotionPaused();
 button.textContent=paused?'Play screens':'Pause screens';
 button.setAttribute('aria-label',paused?'Play TouchDesigner screens':'Pause TouchDesigner screens');
}

function notify(){
 updateButton();
 for(const listener of listeners)listener();
}

export function setTouchDesignerMotionPaused(paused){
 choice=typeof paused==='boolean'?paused:null;
 notify();
}

export function subscribeTouchDesignerMotionChange(listener){
 listeners.add(listener);
 return ()=>listeners.delete(listener);
}

export function initTouchDesignerMotionControl(){
 if(typeof document==='undefined')return;
 const connect=()=>{
  const button=document.getElementById('touchDesignerMotionToggle');
  if(!button || button.dataset.motionControlReady==='true')return;
  button.dataset.motionControlReady='true';
  button.addEventListener('click',()=>setTouchDesignerMotionPaused(!isTouchDesignerMotionPaused()));
  getMotionQuery();
  updateButton();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});
 else connect();
}
