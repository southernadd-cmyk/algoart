import {ThreePerf} from 'three-perf';

// Imported only by the independent test-tower build.
export function mountPhiThreePerf(renderer){
 if(new URLSearchParams(location.search).get('perf')==='0')return null;
 const originalRender=renderer.render,originalAutoReset=renderer.info.autoReset;
 let perf;
 try{
  perf=new ThreePerf({renderer,domElement:document.body,anchorX:'right',anchorY:'bottom',
   logsPerSecond:4,showGraph:true,memory:true,overClock:false,deepAnalyze:false,
   guiVisible:false,backgroundOpacity:.85,scale:matchMedia('(max-width:600px)').matches?.65:.85});
  perf.ui.wrapper.style.zIndex='25';
  perf.ui.wrapper.style.pointerEvents='none';
  perf.ui.wrapper.style.bottom='80px';
 }catch(error){
  renderer.render=originalRender;renderer.info.autoReset=originalAutoReset;
  console.warn('[Test performance monitor] unavailable',error);return null;
 }
 const setLoop=renderer.setAnimationLoop.bind(renderer);
 renderer.setAnimationLoop=callback=>setLoop(callback?function(...args){
  perf.begin();
  try{return callback.apply(this,args);}finally{perf.end();}
 }:null);
 window.__phiThreePerf=perf;
 return perf;
}
