// Full-test-tower JPEG conversion pilot. Opt-in ONLY via ?ktx2=all.
// Loads local archived painting JPEGs, local architectural JPEGs and Poly
// Haven JPEG maps from test-only precompressed assets; never modifies live.
export function createAllJPEGBank(THREE,renderer){
 if(new URLSearchParams(location.search).get('ktx2')!=='all'||!renderer)return null;
 const root=new URL('./ktx2-all/',import.meta.url);
 const diagnostic=globalThis.__phiJPEGAll={
  mode:'all',expected:'every static JPEG used as a GPU texture, including archived paintings',
  requested:0,compressed:0,failed:0,artworks:0,architectural:0,
  fallback:[],assets:{},ready:false
 };
 const polyNames=new Set([
  'plastered_wall_02_diff_1k','plastered_wall_02_nor_gl_1k',
  'concrete_floor_diff_1k','concrete_floor_nor_gl_1k','wood_floor_diff_1k'
 ]);
 const resolve=source=>{
  if(!source||typeof source!=='string')return null;
  let u;try{u=new URL(source,document.baseURI);}catch{return null;}
  const path=u.pathname;
  let asset=null,artwork=false;
  const archive=path.match(/\/gallery\/(\d{4}-\d{2}-\d{2}\/[^/]+\.jpe?g)$/i);
  if(archive){
   asset='gallery/'+archive[1];artwork=true;
  }else{
   const local=path.match(/\/test\/virtual-gallery\/([^?#]+\.jpe?g)$/i);
   if(local)asset='test/virtual-gallery/'+local[1];
   else if(u.hostname==='dl.polyhaven.org'){
    const name=path.split('/').at(-1)?.replace(/\.jpe?g$/i,'')||'';
    if(polyNames.has(name))asset='external/'+name;
   }
  }
  return asset?{url:new URL(asset+'.ktx2',root).href,artwork,source:u.href,asset}:null;
 };
 const promise=import('three/addons/loaders/KTX2Loader.js').then(({KTX2Loader})=>
  new KTX2Loader()
   .setTranscoderPath(new URL('./basis/',import.meta.url).href)
   .setWorkerLimit(2).detectSupport(renderer))
   .then(loader=>{diagnostic.ready=true;return loader});
 const load=async(source,{color=null}={})=>{
  const resolved=resolve(source);
  if(!resolved)throw Error('No generated KTX2 mapping for '+source);
  diagnostic.requested++;
  const begin=performance.now(),id=resolved.asset;
  try{
   const loader=await promise;
   const texture=await loader.loadAsync(resolved.url);
   if(!texture.isCompressedTexture)throw Error('GPU-compressed texture unavailable');
   const isColour=color===null
    ?!/normal|nor_gl|roughness/i.test(id)
    :color;
   texture.colorSpace=isColour?THREE.SRGBColorSpace:THREE.NoColorSpace;
   texture.anisotropy=2;
   texture.userData.galleryJPEGAllPilot=true;
   texture.userData.galleryOriginalSource=source;
   diagnostic.compressed++;
   if(resolved.artwork)diagnostic.artworks++;else diagnostic.architectural++;
   diagnostic.assets[id]={status:'loaded',ms:Math.round(performance.now()-begin),
    bytes:texture.mipmaps?.reduce((s,m)=>s+(m.data?.byteLength||0),0)||0};
   return texture;
  }catch(error){
   diagnostic.failed++;
   const message=String(error?.message||error);
   diagnostic.assets[id]={status:'fallback',error:message};
   if(diagnostic.fallback.length<100)diagnostic.fallback.push({source,id,error:message});
   throw error;
  }
 };
 return {load,resolve,diagnostic};
}
