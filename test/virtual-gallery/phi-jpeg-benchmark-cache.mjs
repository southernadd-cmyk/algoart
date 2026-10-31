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
  // External texture CDNs can support queries too, but making their URLs
  // unstable risks third-party signed/proxied releases. Only same-origin
  // JPEG/KTX2 assets enter a VERIFIED cold sample.
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
