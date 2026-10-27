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
export async function warmGalleryEntry({renderer,scene,camera,nextFrame=galleryPreparationFrame}){
 if(renderer.compileAsync)await renderer.compileAsync(scene,camera);
 const textures=new Set();
 scene.traverse(object=>{for(const material of [].concat(object.material||[])){
  for(const value of Object.values(material))if(value?.isTexture&&!value.isRenderTargetTexture)textures.add(value);
 }});
 // Warm the full scene, including textures in rooms outside the starting view.
 // Each upload happens behind the welcome screen, with UI time between them.
 let batch=0;
 for(const texture of textures){
  if(batch++%4===0)await nextFrame();
  try{renderer.initTexture(texture);}catch(error){console.warn('Gallery texture warm-up skipped',error);}
 }
 renderer.render(scene,camera);await nextFrame();
 return {textures:textures.size};
}
