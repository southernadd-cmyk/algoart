// Account for Three loaders while the welcome screen is visible. Failed loads
// still receive itemEnd; the deadline also permits entry on a stalled network.
export function trackGalleryLoading(manager){
 let pending=0;
 const start=manager.itemStart,end=manager.itemEnd;
 function itemStart(...args){pending++;return start.apply(manager,args);}
 function itemEnd(...args){pending=Math.max(0,pending-1);return end.apply(manager,args);}
 manager.itemStart=itemStart;manager.itemEnd=itemEnd;
 return {get pending(){return pending;},dispose(){
  if(manager.itemStart===itemStart)manager.itemStart=start;
  if(manager.itemEnd===itemEnd)manager.itemEnd=end;
 }};
}
export function galleryPreparationFrame(){
 return new Promise(resolve=>{
  let done=false;
  const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};
  const timer=setTimeout(finish,80);
  requestAnimationFrame(()=>setTimeout(finish,0));
 });
}
export async function waitForGalleryEntry({loading,isBusy,pump,nextFrame=galleryPreparationFrame,now=()=>performance.now(),timeout=12000}){
 const start=now();let quiet=0;
 while(now()-start<timeout){
  pump();await nextFrame();
  quiet=loading.pending===0&&!isBusy()?quiet+1:0;
  // Let promise continuations attach glTFs and start their dependent loads.
  if(quiet>=3)return {timedOut:false,ms:now()-start};
 }
 return {timedOut:true,ms:now()-start};
}
export async function warmGalleryEntry({renderer,scene,camera,nextFrame=galleryPreparationFrame,onStage=null,isAlreadyUploaded=()=>false,markUploaded=()=>{}}){
 const timer=()=>performance.now();
 const totalStart=timer(),slowUploads=[];
 let then=timer();
 if(renderer.compileAsync)await renderer.compileAsync(scene,camera);
 const compileMs=timer()-then;
 then=timer();
 const textures=new Set();
 scene.traverse(object=>{for(const material of [].concat(object.material||[])){
  for(const value of Object.values(material))if(value?.isTexture&&!value.isRenderTargetTexture)textures.add(value);
 }});
 const traversalMs=timer()-then;
 // Always use exactly the approved GPU work and renderer order; only
 // record stage timing when ?liftprofile=1 has explicitly enabled it.
 then=timer();let batch=0,failedUploads=0,skippedUploads=0,attemptedUploads=0;
 for(const texture of textures){
  // Only bypass work when this same renderer previously completed the
  // upload successfully. Never skip a shader compile, material, or image.
  if(isAlreadyUploaded(texture)){skippedUploads++;continue;}
  if(batch++%4===0)await nextFrame();
  const started=onStage?timer():0;
  attemptedUploads++;
  try{renderer.initTexture(texture);markUploaded(texture);}
  catch(error){failedUploads++;console.warn('Gallery texture warm-up skipped',error);}
  if(onStage){
   const ms=timer()-started;
   if(ms>=40)slowUploads.push({ms:+ms.toFixed(1),width:texture.image?.width||0,
    height:texture.image?.height||0,format:texture.format||null});
  }
 }
 const uploadMs=timer()-then;
 then=timer();
 renderer.render(scene,camera);
 const finalRenderMs=timer()-then;
 await nextFrame();
 const diagnostic={textures:textures.size};
 if(onStage)onStage('warmup-details',{compileMs:+compileMs.toFixed(1),
  traversalMs:+traversalMs.toFixed(1),uploadMs:+uploadMs.toFixed(1),
  finalRenderMs:+finalRenderMs.toFixed(1),totalMs:+(timer()-totalStart).toFixed(1),
  failedUploads,skippedUploads,attemptedUploads,slowUploads:slowUploads.sort((a,b)=>b.ms-a.ms).slice(0,12)});
 return diagnostic;
}
