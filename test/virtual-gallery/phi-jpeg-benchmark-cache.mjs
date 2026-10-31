// TEST ONLY: deterministic per-session cache identities for JPEG/KTX2 A/B.
// Changes image/texture HTTP URLs only when explicit benchcache/benchseed are
// supplied. Never touches live or default gallery navigation.
const IMAGE_SOURCE=/\.(?:jpe?g|ktx2)(?:$|[?#])/i;
export function createTextureBenchCache(search,baseHref,origin){
 const params=new URLSearchParams(search);
 const mode=params.get('benchcache'),seed=params.get('benchseed')||'';
 if(!['cold','warm'].includes(mode)||!/^[A-Za-z0-9_-]{8,96}$/.test(seed))return null;
 const assets=new Set();
 function stamp(source){
  if(typeof source!=='string'||!IMAGE_SOURCE.test(source))return source;
  let url;
  try{url=new URL(source,baseHref)}catch{return source}
  // Mirror the five original Poly Haven JPEGs into TEST for fair comparison
  // against their same-origin lossless KTX2 equivalents. Both variants then
  // obey the same cache identity. All mirrors are original JPEG bytes.
  if(url.hostname==='dl.polyhaven.org'){
   const basename=url.pathname.split('/').at(-1)?.replace(/\.jpe?g$/i,'');
   const allowed=['plastered_wall_02_diff_1k','plastered_wall_02_nor_gl_1k',
    'concrete_floor_diff_1k','concrete_floor_nor_gl_1k','wood_floor_diff_1k'];
   if(allowed.includes(basename))
    url=new URL('./ktx2-lossless/external-jpeg/'+basename+'.jpg',import.meta.url);
  }
  if(url.origin!==origin)return source;
  url.searchParams.set('phiBenchAsset',seed);
  assets.add(url.pathname);
  return url.href;
 }
 return {
  mode,seed,stamp,requestedAssets:assets,
  metadata:()=>({mode,seed,requestedAssets:[...assets]})
 };
}
