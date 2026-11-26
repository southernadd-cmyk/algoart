import {downloadSplatPack} from './r2-loader.mjs';
const live=(body,pivot)=>!body.userData.galleryDisposed&&!pivot.userData.galleryDisposed&&!!body.parent;
export function createSculptureSplatRenderer({THREE,renderer,scene,loadSpark=()=>import('@sparkjsdev/spark'),loadPack=downloadSplatPack,maxCacheBytes=24*1048576,maxCachedPacks=2,now=()=>performance.now(),yieldWork=()=>new Promise(resolve=>setTimeout(resolve,0))}){
 const records=new Map(),packs=new Map(),pending=new Map(),recentFailures=new Map();
 let cacheBytes=0,constructionTail=Promise.resolve();
 let spark=null,sparkRequest=null,disabled=false;
 const stats={ready:0,active:0,failed:0,disposed:0,lastError:null,cacheHits:0,cacheMisses:0,packLoads:0,evictions:0,culled:0,constructedPoints:0};
 function texturePixels(texture,textures){
  if(!texture?.image)return null;if(textures.has(texture))return textures.get(texture);
  const image=texture.image,w=Math.min(1024,image.naturalWidth||image.width),h=Math.min(1024,image.naturalHeight||image.height);
  if(!w||!h)throw Error('Painting texture not ready');
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);
  const result={w,h,data:ctx.getImageData(0,0,w,h).data};textures.set(texture,result);return result;
 }

 function runtime(){
  if(disabled)throw Error('Splat rendering disabled');
  sparkRequest??=loadSpark().then(api=>{if(disabled)throw Error('Splat rendering disabled');spark=new api.SparkRenderer({renderer,depthTest:true,depthWrite:false});return api;}).catch(e=>{disabled=true;throw e;});
  return sparkRequest;
 }
 function evict(){
  while(packs.size>maxCachedPacks||cacheBytes>maxCacheBytes){
   const key=packs.keys().next().value,entry=packs.get(key);
   packs.delete(key);cacheBytes-=entry.bytes;stats.evictions++;
  }
 }
 function packFor(date,quality,sourceSha256){
  const key=date+':'+quality+':'+sourceSha256;
  if(packs.has(key)){
   const entry=packs.get(key);packs.delete(key);packs.set(key,entry);stats.cacheHits++;
   return Promise.resolve(entry.pack);
  }
  if(pending.has(key)){stats.cacheHits++;return pending.get(key);}
  const failure=recentFailures.get(key);
  if(failure&&now()-failure.at<30000){stats.cacheHits++;return Promise.reject(failure.error);}
  recentFailures.delete(key);stats.cacheMisses++;stats.packLoads++;
  const task=Promise.resolve().then(()=>loadPack(date,quality,{sourceSha256,fetcher:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(30000)})})).then(pack=>{
   // Track actual decoded point memory, not the much smaller gzip size.
   const bytes=Object.values(pack.studies).reduce((n,asset)=>n+asset.points.byteLength,0);
   if(!disabled&&bytes<=maxCacheBytes&&maxCachedPacks>0){
    packs.set(key,{pack,bytes});cacheBytes+=bytes;evict();
   }
   return pack;
  }).catch(error=>{
   if(!disabled){recentFailures.set(key,{at:now(),error});while(recentFailures.size>4)recentFailures.delete(recentFailures.keys().next().value);}
   throw error;
  }).finally(()=>{if(pending.get(key)===task)pending.delete(key);});
  pending.set(key,task);return task;
 }
 // Start verified pack fetching while the painting image is still decoding.
 function prefetch({date,quality,sourceSha256}){
  if(disabled||!sourceSha256||renderer.xr?.isPresenting)return;
  packFor(date,quality,sourceSha256).catch(()=>{});
 }
 function scheduleConstruction(task){
  const work=constructionTail.then(yieldWork).then(task);
  constructionTail=work.catch(()=>{});return work;
 }
 function toggle(r,active){
  if(r.active===active)return;
  r.active=active;
  for(const m of r.meshes)m.mesh.visible=active?false:m.visible;
  if(active)r.body.add(r.splat);else r.splat.removeFromParent();
  stats.active+=active?1:-1;
  r.body.userData.sculptureRepresentation=active?'splats':'mesh';
 }
 function dispose(body){
  const r=records.get(body);if(!r)return;
  toggle(r,false);try{r.splat.dispose?.();}catch(error){stats.lastError=String(error?.message||error);}records.delete(body);delete body.userData.disposeSculptureSplats;
  stats.disposed++;stats.ready=records.size;
 }
 function sceneVisibility(body){
  let visible=true;
  for(let node=body;node;node=node.parent){if(node.visible===false)visible=false;if(node===scene)return visible?'visible':'culled';}
  return 'detached';
 }
 function beforeRender(){
  stats.culled=0;
  for(const [body,r] of records){
   if(!live(body,r.pivot)){dispose(body);continue;}
   const visibility=sceneVisibility(body);
   if(visibility==='culled')stats.culled++;
   toggle(r,!disabled&&!renderer.xr?.isPresenting&&visibility==='visible');
  }
  if(spark){if(stats.active>0&&spark.parent!==scene)scene.add(spark);else if(!stats.active)spark.removeFromParent();}
 }
 function renderFrame(draw){
  try{beforeRender();return draw();}
  catch(error){
   if(!stats.active)throw error;
   // Restore physical geometry and retry the same frame without Spark.
   fail(error);return draw();
  }
 }
 function fail(error){
  disabled=true;stats.lastError=String(error?.message||error);
  for(const body of [...records.keys()])dispose(body);
  packs.clear();cacheBytes=0;recentFailures.clear();
  spark?.removeFromParent();try{spark?.dispose?.();}catch{}spark=null;
 }
 async function enhance({body,pivot,date,quality,name,seed,sourceSha256}){
  if(disabled||!live(body,pivot)||records.has(body)||!sourceSha256)return false;
  let splat=null;
  try{
   const pack=await packFor(date,quality,sourceSha256);
   if(disabled||!live(body,pivot))return false;
   return await scheduleConstruction(async()=>{
   if(disabled||!live(body,pivot)||records.has(body))return false;
   const textures=new Map(); // Temporary canvas pixels only for this construction.
   const asset=Object.hasOwn(pack.studies,name)?pack.studies[name]:null;
   const originals=body.children.filter(m=>m.isMesh);
   if(!asset||asset.seed!==seed||asset.originalTriangles!==body.userData.polygonTriangles||asset.meshCounts.length!==originals.length)throw Error('Splat source does not match mounted sculpture');
   for(const [i,mesh] of originals.entries()){
    const [vertices,indices]=asset.meshCounts[i];
    if(mesh.geometry.attributes.position.count!==vertices||mesh.geometry.index.count!==indices||!Array.isArray(mesh.material)||mesh.material.length!==asset.materialCounts[i])throw Error('Splat geometry/material count mismatch');
    for(const material of mesh.material)if(material.map)texturePixels(material.map,textures);
   }
   const {SplatMesh}=await runtime();
   if(disabled||!live(body,pivot))return false;
   const points=asset.points;
   const z=new THREE.Vector3(0,0,1),normal=new THREE.Vector3(),position=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion(),colour=new THREE.Color(),sampleColour=new THREE.Color(),light=new THREE.Vector3(.35,.85,.38).normalize();
    splat=new SplatMesh({raycastable:false,constructSplats(packed){
     for(let i=0;i<points.length;i+=11){
      position.fromArray(points,i);normal.fromArray(points,i+3).normalize();q.setFromUnitVectors(z,normal);
      const radius=points[i+8];scale.set(radius,radius,Math.max(.0008,radius*.12));
      const material=originals[points[i+9]].material[points[i+10]];
      colour.copy(material.color);const image=texturePixels(material.map,textures);
      if(image){
       const x=Math.min(image.w-1,Math.max(0,Math.floor(points[i+6]*image.w))),y=Math.min(image.h-1,Math.max(0,Math.floor((1-points[i+7])*image.h))),at=(y*image.w+x)*4;
       sampleColour.setRGB(image.data[at]/255,image.data[at+1]/255,image.data[at+2]/255,THREE.SRGBColorSpace);colour.multiply(sampleColour);
      }
      colour.multiplyScalar(.65+.35*Math.max(0,normal.dot(light)));
      packed.pushSplat(position,scale,q,material.opacity,colour);
     }
    }});

   await splat.initialized;
   textures.clear();
   if(disabled||!live(body,pivot)||records.has(body)){splat.dispose?.();return false;}
   records.set(body,{body,pivot,splat,meshes:originals.map(mesh=>({mesh,visible:mesh.visible})),active:false});
   body.userData.disposeSculptureSplats=()=>dispose(body);stats.ready=records.size;
   stats.constructedPoints+=points.length/11;
   beforeRender();return true;
   });
  }catch(error){
   splat?.dispose?.();stats.failed++;stats.lastError=String(error?.message||error);
   return false;
  }
 }
 renderer.domElement?.addEventListener('webglcontextlost',()=>fail(Error('WebGL context lost')));
 return {enhance,prefetch,beforeRender,renderFrame,fail,dispose,stats:()=>({...stats,disabled,cachedPacks:packs.size,cacheBytes,pendingPacks:pending.size})};
}
