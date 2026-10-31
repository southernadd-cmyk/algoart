// TEST ONLY. Browser-compatible, pixel-exact JPEG -> raw RGBA8 KTX2 Zstandard.
// Enabled by ?jpegformat=lossless. Default JPEG/WebP and live code unaffected.
// Every file is checked byte-for-byte against decoded JPEG pixels at build time.
export function createJPEGParityBank(THREE,renderer){
 const p=new URLSearchParams(location.search);
 if(p.get('jpegformat')!=='lossless'||!renderer)return null;
 const base=new URL('./ktx2-lossless/',import.meta.url);
 const poly=new Set(['plastered_wall_02_diff_1k','plastered_wall_02_nor_gl_1k',
  'concrete_floor_diff_1k','concrete_floor_nor_gl_1k','wood_floor_diff_1k']);
 const resolve=src=>{
  if(!src||typeof src!=='string')return null;
  let url;try{url=new URL(src,document.baseURI)}catch{return null}
  let path=url.pathname,asset=null,artwork=false;
  const date=path.match(/\/gallery\/(\d{4}-\d{2}-\d{2}\/[^/]+\.jpe?g)$/i);
  const release=path.match(/\/gallery\/release-art\/([^/]+\.jpe?g)$/i);
  const local=path.match(/\/test\/virtual-gallery\/([^?]+\.jpe?g)$/i);
  // Test HTML deliberately has <base href="../../gallery/visit/">, so
  // original relative JPEG paths resolve to live's mirrored assets.
  // Always map their KTX2 equivalents to the isolated TEST-only files.
  const mirrored=path.match(/\/gallery\/visit\/((?:textures|assets)\/[^?#]+\.jpe?g)$/i);
  if(date){asset='gallery/'+date[1];artwork=true;}
  else if(release){asset='gallery/release-art/'+release[1];artwork=true;}
  else if(local)asset='test/virtual-gallery/'+local[1];
  else if(mirrored)asset='test/virtual-gallery/'+mirrored[1];
  else if(url.hostname==='dl.polyhaven.org'){
   const name=path.split('/').at(-1)?.replace(/\.jpe?g$/i,'');
   if(poly.has(name))asset='external/'+name;
  }
  return asset?{asset,artwork,url:new URL(asset+'.ktx2',base).href}:null;
 };
 const diagnostics=window.__phiJPEGLossless={
  mode:'lossless-RGBA8-Zstd',enabled:true,requested:0,loaded:0,failed:0,
  artworks:0,architectural:0,bytes:0,failures:[],assetStats:{}
 };
 let loaderPromise=null;
 function getLoader(){
  if(!loaderPromise)loaderPromise=import('three/addons/loaders/KTX2Loader.js')
   .then(({KTX2Loader})=>new KTX2Loader()
    .setTranscoderPath(new URL('./basis/',import.meta.url).href)
    .setWorkerLimit(2).detectSupport(renderer));
  return loaderPromise;
 }
 async function load(source,{color=null}={}){
  const target=resolve(source);
  if(!target)throw Error('JPEG source has no lossless counterpart: '+source);
  diagnostics.requested++;
  const begin=performance.now();
  try{
   const loader=await getLoader();
   const texture=await loader.loadAsync(globalThis.__phiJPEGCacheBench?.stamp(target.url)||target.url);
   // DataTexture, never hardware-block-compressed: guarantees exact base
   // RGBA8 texels, unlike Basis ETC1S/UASTC.
   if(!texture.isDataTexture||texture.isCompressedTexture||
      !texture.image?.data||texture.mipmaps.length!==1)
    throw Error('KTX2 was not uncompressed RGBA8 level-zero texture: '+target.asset);
   texture.colorSpace=color===null
    ?(/normal|nor_gl|roughness/i.test(target.asset)?THREE.NoColorSpace:THREE.SRGBColorSpace)
    :(color?THREE.SRGBColorSpace:THREE.NoColorSpace);
   texture.flipY=true;
   texture.minFilter=THREE.LinearMipmapLinearFilter;
   texture.magFilter=THREE.LinearFilter;
   // Generate GPU mips in exactly the same manner as JPEG TextureLoader.
   texture.mipmaps=[];
   texture.generateMipmaps=true;
   texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
   texture.needsUpdate=true;
   texture.userData.galleryPersistent=true;
   texture.userData.jpegPixelExact=true;
   diagnostics.loaded++;
   if(target.artwork)diagnostics.artworks++;else diagnostics.architectural++;
   diagnostics.bytes+=texture.image.data.byteLength;
   diagnostics.assetStats[target.asset]={
    ms:Math.round(performance.now()-begin),bytes:texture.image.data.byteLength,
    width:texture.image.width,height:texture.image.height,
    pixelExactFromManifest:true};
   return texture;
  }catch(error){
   diagnostics.failed++;
   if(diagnostics.failures.length<80)
    diagnostics.failures.push({asset:target.asset,error:String(error)});
   throw error;
  }
 }
 function toCanvas(texture){
  const {data,width,height}=texture.image;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer,data.byteOffset,data.byteLength),width,height),0,0);
  return canvas;
 }
 return {resolve,load,toCanvas,diagnostics};
}
