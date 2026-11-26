import {downloadSplatPack} from './r2-loader.mjs';
const live=(body,pivot)=>!body.userData.galleryDisposed&&!pivot.userData.galleryDisposed&&!!body.parent;
export function createSculptureSplatRenderer({THREE,renderer,scene,loadSpark=()=>import('@sparkjsdev/spark'),loadPack=downloadSplatPack}){
 const records=new Map(),packs=new Map();
 let spark=null,sparkRequest=null,disabled=false;
 const stats={ready:0,active:0,failed:0,disposed:0,lastError:null};
 const textures=new WeakMap();
 function texturePixels(texture){
  if(!texture?.image)return null;if(textures.has(texture))return textures.get(texture);
  const image=texture.image,w=Math.min(1024,image.naturalWidth||image.width),h=Math.min(1024,image.naturalHeight||image.height);
  if(!w||!h)throw Error('Painting texture not ready');
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);
  const result={w,h,data:ctx.getImageData(0,0,w,h).data};textures.set(texture,result);return result;
 }

 function runtime(){
  if(disabled)throw Error('Splat rendering disabled');
  sparkRequest??=loadSpark().then(api=>{spark=new api.SparkRenderer({renderer,depthTest:true,depthWrite:false});return api;}).catch(e=>{disabled=true;throw e;});
  return sparkRequest;
 }
 function packFor(date,quality,sourceSha256){
  const key=date+':'+quality+':'+sourceSha256;
  if(packs.has(key))return packs.get(key);
  const task=loadPack(date,quality,{sourceSha256,fetcher:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(30000)})}).catch(e=>{if(packs.get(key)===task)packs.delete(key);throw e;});
  packs.set(key,task);
  while(packs.size>2)packs.delete(packs.keys().next().value);
  return task;
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
  toggle(r,false);r.splat.dispose?.();records.delete(body);delete body.userData.disposeSculptureSplats;
  stats.disposed++;stats.ready=records.size;
 }
 function onScene(body){for(let node=body;node;node=node.parent)if(node===scene)return true;return false;}
 function beforeRender(){
  for(const [body,r] of records){
   if(!live(body,r.pivot)){dispose(body);continue;}
   toggle(r,!disabled&&!renderer.xr?.isPresenting&&onScene(body));
  }
  if(spark){if(stats.active>0&&spark.parent!==scene)scene.add(spark);else if(!stats.active)spark.removeFromParent();}
 }
 function fail(error){
  disabled=true;stats.lastError=String(error?.message||error);
  for(const r of records.values())toggle(r,false);
  spark?.removeFromParent();
 }
 async function enhance({body,pivot,date,quality,name,seed,sourceSha256}){
  if(disabled||!live(body,pivot)||records.has(body)||!sourceSha256)return false;
  let splat=null;
  try{
   const pack=await packFor(date,quality,sourceSha256);
   if(disabled||!live(body,pivot))return false;
   const asset=Object.hasOwn(pack.studies,name)?pack.studies[name]:null;
   const originals=body.children.filter(m=>m.isMesh);
   if(!asset||asset.seed!==seed||asset.originalTriangles!==body.userData.polygonTriangles||asset.meshCounts.length!==originals.length)throw Error('Splat source does not match mounted sculpture');
   for(const [i,mesh] of originals.entries()){
    const [vertices,indices]=asset.meshCounts[i];
    if(mesh.geometry.attributes.position.count!==vertices||mesh.geometry.index.count!==indices||!Array.isArray(mesh.material)||mesh.material.length!==asset.materialCounts[i])throw Error('Splat geometry/material count mismatch');
    for(const material of mesh.material)if(material.map)texturePixels(material.map);
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
      colour.copy(material.color);const image=texturePixels(material.map);
      if(image){
       const x=Math.min(image.w-1,Math.max(0,Math.floor(points[i+6]*image.w))),y=Math.min(image.h-1,Math.max(0,Math.floor((1-points[i+7])*image.h))),at=(y*image.w+x)*4;
       sampleColour.setRGB(image.data[at]/255,image.data[at+1]/255,image.data[at+2]/255,THREE.SRGBColorSpace);colour.multiply(sampleColour);
      }
      colour.multiplyScalar(.65+.35*Math.max(0,normal.dot(light)));
      packed.pushSplat(position,scale,q,material.opacity,colour);
     }
    }});

   await splat.initialized;
   if(disabled||!live(body,pivot)||records.has(body)){splat.dispose?.();return false;}
   records.set(body,{body,pivot,splat,meshes:originals.map(mesh=>({mesh,visible:mesh.visible})),active:false});
   body.userData.disposeSculptureSplats=()=>dispose(body);stats.ready=records.size;
   beforeRender();return true;
  }catch(error){
   splat?.dispose?.();stats.failed++;stats.lastError=String(error?.message||error);
   return false;
  }
 }
 renderer.domElement?.addEventListener('webglcontextlost',()=>fail(Error('WebGL context lost')));
 return {enhance,beforeRender,fail,dispose,stats:()=>({...stats,disabled,cachedPacks:packs.size})};
}
