/**
 * Read-only media Worker for the EXISTING Cloudflare media bucket.
 * Legacy editions/ URL contract is preserved. Only SHA-addressed V2 added.
 */
const PAGES_ORIGIN="https://southernadd-cmyk.github.io";
const DATE="\\d{4}-\\d{2}-\\d{2}";
const HASH="[a-f0-9]{64}";
const LEGACY_ART=new RegExp(
  "^editions/"+DATE+"/[A-Za-z0-9_-]+/(?:original-"+HASH+
  "\\.(?:jpg|jpeg|png)|(?:desktop|mobile)-"+HASH+"\\.webp)$"
);
const LEGACY_EDITION=new RegExp(
  "^editions/"+DATE+"/(?:cover-"+HASH+"\\.jpg|sculptures-"+HASH+"\\.json\\.gz)$"
);
const V2_PREFIX="sculptures-v2/v4\\.2\\.1-20261110";
const V2_FLOOR=new RegExp(
  "^"+V2_PREFIX+"/floors/"+DATE+"/(?:desktop|mobile)/"+HASH+"\\.json\\.gz$"
);
const V2_RECEPTION=new RegExp(
  "^"+V2_PREFIX+"/reception/(?:image/"+HASH+
  "\\.png|(?:source|manifest)/"+HASH+
  "\\.json|(?:desktop|mobile)/"+HASH+"\\.json\\.gz)$"
);
const V2_CATALOG=new RegExp(
  "^"+V2_PREFIX+"/catalog/"+HASH+"\\.json$"
);
const MIME={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",
  webp:"image/webp","json.gz":"application/gzip",json:"application/json"};
function allowedKey(key){
  return key.length<=320&&(
    LEGACY_ART.test(key)||LEGACY_EDITION.test(key)||
    V2_FLOOR.test(key)||V2_RECEPTION.test(key)||V2_CATALOG.test(key)
  );
}
function typeFor(key){
  const ext=key.endsWith(".json.gz")?"json.gz":key.slice(key.lastIndexOf(".")+1);
  return MIME[ext];
}
function headers(){
  return new Headers({
    "X-Content-Type-Options":"nosniff",
    "Cross-Origin-Resource-Policy":"cross-origin",
    "Access-Control-Allow-Origin":PAGES_ORIGIN
  });
}
function refusal(code,message){
  const h=headers();
  h.set("Content-Type","text/plain; charset=utf-8");
  h.set("Cache-Control","no-store");
  if(code===405)h.set("Allow","GET, HEAD, OPTIONS");
  return new Response(message,{status:code,headers:h});
}
export default {
  async fetch(request,env){
    const origin=request.headers.get("Origin");
    if(request.method==="OPTIONS"){
      if(origin!==PAGES_ORIGIN||
          !["GET","HEAD"].includes(request.headers.get("Access-Control-Request-Method")))
        return refusal(403,"Origin or preflight method not allowed");
      const h=headers();
      h.set("Access-Control-Allow-Methods","GET, HEAD");
      h.set("Access-Control-Max-Age","3600");
      h.set("Cache-Control","no-store");
      return new Response(null,{status:204,headers:h});
    }
    if(!["GET","HEAD"].includes(request.method))
      return refusal(405,"Read-only media service");
    const url=new URL(request.url),key=url.pathname.slice(1);
    if(url.search||!allowedKey(key))
      return refusal(404,"Not found");
    const media=env.MEDIA;
    if(!media||typeof media.get!=="function"||typeof media.head!=="function")
      return refusal(503,"Media temporarily unavailable");
    try{
      const item=request.method==="HEAD"?await media.head(key):await media.get(key);
      if(!item)return refusal(404,"Not found");
      const h=headers();
      h.set("Content-Type",typeFor(key));
      h.set("Cache-Control","public, max-age=31536000, immutable");
      if(Number.isFinite(item.size))h.set("Content-Length",String(item.size));
      if(item.httpEtag)h.set("ETag",item.httpEtag);
      return new Response(request.method==="HEAD"?null:item.body,
        {status:200,headers:h});
    }catch(error){
      console.error("Read-only media retrieval failed",
        String(error?.message||error));
      return refusal(503,"Media temporarily unavailable");
    }
  }
};
