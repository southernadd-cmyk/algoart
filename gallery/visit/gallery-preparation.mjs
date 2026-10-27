// Yield between optional preparation tasks; retain original asset detail.
export function nextGalleryFrame(){
 return new Promise(resolve=>{
  if(typeof requestAnimationFrame!=='function'){setTimeout(resolve,0);return;}
  let finished=false;
  const done=()=>{if(finished)return;finished=true;clearTimeout(timer);resolve();};
  const timer=setTimeout(done,80);
  requestAnimationFrame(()=>setTimeout(done,0));
 });
}
export function createGalleryPreparationQueue({yieldFrame=nextGalleryFrame}={}){
 const pending=[];
 const stats={queued:0,completed:0,failed:0,active:0,maxTaskMs:0,totalTaskMs:0};
 let running=false;
 async function drain(){
  if(running)return;running=true;
  try{
   while(pending.length){
    await yieldFrame();pending.sort((a,b)=>b.priority-a.priority);
    const job=pending.shift();stats.active=1;
    const start=performance.now();
    try{const result=await job.run();stats.completed++;job.resolve(result);}
    catch(error){stats.failed++;job.reject(error);}
    finally{const ms=performance.now()-start;stats.totalTaskMs+=ms;stats.maxTaskMs=Math.max(stats.maxTaskMs,ms);stats.active=0;}
   }
  }finally{running=false;}
 }
 return {stats,enqueue(run,{priority=0}={}){
  stats.queued++;
  const promise=new Promise((resolve,reject)=>pending.push({run,priority,resolve,reject}));
  void drain();return promise;
 }};
}
let preparation=null;
export function configureGalleryPreparation(options){preparation=options;}
export function stageGalleryTextureCallback(run){
 if(!preparation)return run();
 return preparation.textureTasks.enqueue(run).catch(error=>console.warn('Gallery texture preparation failed',error));
}
// Let Three upload textures during normal rendering. Explicit initTexture
// forced driver synchronisation and made the first candidate stall more.
export async function prepareGalleryTexture(texture){}
export async function prepareGalleryModel(model){
 if(!preparation)return model;
 // Stagger model attachment without compiling detached models or uploading
 // their entire texture set while the visitor is already moving.
 return preparation.models.enqueue(()=>model);
}
const neutralBanks=new WeakMap();
export function neutralGalleryMaps(THREE){
 if(neutralBanks.has(THREE))return neutralBanks.get(THREE);
 const make=(data,color=false)=>{
  const texture=new THREE.DataTexture(new Uint8Array(data),1,1);
  if(color)texture.colorSpace=THREE.SRGBColorSpace;
  texture.userData.galleryPersistent=true;texture.userData.galleryPlaceholder=true;
  texture.needsUpdate=true;return texture;
 };
 const maps={white:make([255,255,255,255],true),roughness:make([255,255,255,255]),normal:make([128,128,255,255])};
 neutralBanks.set(THREE,maps);return maps;
}
