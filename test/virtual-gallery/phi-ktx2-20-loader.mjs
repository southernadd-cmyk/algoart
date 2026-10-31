// Opt-in 20-candidate architectural texture pilot. TEST TOWER ONLY.
// The current tower uses 8 direct GPU maps; 12 optional candidates are
// reserved for the separate 20-map stress test. Never rewrite artwork maps.
export function createKTX20Bank(THREE,{renderer,lowPower=false,startAfter=null}={}){
 const params=new URLSearchParams(location.search);
 if(params.get('ktx2')!=='20'||!renderer||lowPower)return null;
 const coldseed=params.get('coldseed');
 const makeURL=id=>{
  const url=new URL('../../test/virtual-gallery/ktx2-20/'+id+'.ktx2',document.baseURI);
  if(coldseed)url.searchParams.set('ktxCold',coldseed);
  return url.href;
 };
 const diagnostics=globalThis.__phiKTX20={
  mode:'twenty',candidateCount:20,sceneCandidates:8,
  status:'preparing',loaded:0,failed:0,assets:{},
  note:'Core brick color remains JPEG-tinted to preserve original appearance; optional assets are not automatically loaded'
 };
 const loaderPromise=Promise.resolve(startAfter).catch(()=>{}).then(async()=>{
  const {KTX2Loader}=await import('three/addons/loaders/KTX2Loader.js');
  return new KTX2Loader()
    .setTranscoderPath(new URL('../../test/virtual-gallery/basis/',document.baseURI).href)
    .setWorkerLimit(2).detectSupport(renderer);
 });
 const pending=new Map();
 const update=()=>{
  const done=diagnostics.loaded+diagnostics.failed;
  diagnostics.status=done>=diagnostics.sceneCandidates
   ?diagnostics.failed?'partial-fallback':'loaded':'preparing';
 };
 const load=(id,{color=false}={})=>{
  if(pending.has(id))return pending.get(id);
  const job=(async()=>{
   const started=performance.now();
   try{
    const loader=await loaderPromise;
    const texture=await loader.loadAsync(makeURL(id));
    if(!texture.isCompressedTexture)throw Error('GPU compression unavailable for '+id);
    texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=2;texture.userData.galleryPersistent=true;
    diagnostics.assets[id]={status:'loaded',ms:Math.round(performance.now()-started),
      bytes:texture.mipmaps?.reduce((n,m)=>n+(m.data?.byteLength||0),0)||0,
      mips:texture.mipmaps?.length||0};
    diagnostics.loaded++;
    update();
    return texture;
   }catch(error){
    diagnostics.assets[id]={status:'fallback-jpg',error:String(error?.message||error)};
    diagnostics.failed++;update();throw error;
   }
  })();
  pending.set(id,job);
  return job;
 };
 return {load,diagnostics};
}
