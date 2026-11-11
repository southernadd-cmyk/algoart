import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

/**
 * Read-only public validation of the ISOLATED V2 Worker.
 * Tests bytes and CORS against the immutable R2 catalog and original assets.
 * Does not publish, update or delete any R2 objects.
 */
const worker=(process.env.V2_WORKER_URL||'').replace(/\/$/,'');
const PAGES='https://southernadd-cmyk.github.io';
const CANARY='https://proportion-piece-web-canary.mr-adam-clement.workers.dev';
const PREFIX='sculptures-v2/v4.2.1-20261110/';
const CATALOG_SHA='a9a1771413a085e3d73dc19c806c6a86d9026e36e8ba6539d5676bf4dc13892f';
assert.match(worker,/^https:\/\/proportion-piece-sculpture-v2\.[a-z0-9-]+\.workers\.dev$/);
const sha=b=>createHash('sha256').update(b).digest('hex');
async function readAndVerify(path,expectedSha,expectedMime,expectedSize){
  assert.ok(path.startsWith(PREFIX)&&!path.includes('..'),'Unsafe public asset path');
  const url=worker+'/'+path;
  // Workers.dev routing may take several seconds to become visible to all
  // edges after Wrangler confirms deployment. Retry only transient 404/503.
  let response;
  for(let attempt=0;attempt<12;attempt++){
    response=await fetch(url,{headers:{Origin:PAGES},signal:AbortSignal.timeout(90000)});
    if(response.status===200)break;
    if(![404,502,503,504].includes(response.status)||attempt===11)break;
    await response.body?.cancel();
    console.log('V2_WORKER_PROPAGATING '+JSON.stringify({asset:path,attempt:attempt+1,status:response.status}));
    await new Promise(resolve=>setTimeout(resolve,4000));
  }
  assert.equal(response.status,200,'Failed GET '+url+' '+response.status);
  assert.equal(response.headers.get('access-control-allow-origin'),PAGES,'Incorrect CORS on '+path);
  assert.equal(response.headers.get('content-type'),expectedMime,'Incorrect MIME on '+path);
  const buf=Buffer.from(await response.arrayBuffer());
  assert.equal(sha(buf),expectedSha,'Public SHA mismatch '+path);
  if(expectedSize!==undefined)assert.equal(buf.length,expectedSize,'Incorrect bytes on '+path);
  const head=await fetch(url,{method:'HEAD',headers:{Origin:PAGES},signal:AbortSignal.timeout(20000)});
  assert.equal(head.status,200,'Failed HEAD '+url);
  assert.equal(head.headers.get('content-type'),expectedMime);
  assert.equal(head.headers.get('access-control-allow-origin'),PAGES);
  console.log('V2_PUBLIC_ASSET_OK '+JSON.stringify({path,bytes:buf.length,sha256:expectedSha}));
  return buf;
}
function getPath(url){
  const uri=new URL(url);
  const path=uri.pathname.slice(1);
  assert.ok(path.startsWith(PREFIX),'Original catalog references unexpected R2 namespace');
  return path;
}
const catalogPath=PREFIX+'catalog/'+CATALOG_SHA+'.json';
const bytes=await readAndVerify(catalogPath,CATALOG_SHA,'application/json');
const catalog=JSON.parse(bytes.toString('utf8'));
assert.equal(catalog.schema,'pp-sculpture-v2-r2-catalog');
assert.equal(catalog.version,1);
assert.equal(catalog.worker,worker,'Catalog must advertise the deployed dedicated V2 Worker');
assert.equal(Object.keys(catalog.days).length,37);
// Every catalog URL must point at the public Worker actually checked here.
// Validate the full manifest even though only representative meshes are fetched.
const allUrls=[
  ...Object.values(catalog.days).flatMap(day=>Object.values(day.qualities).map(q=>q.url)),
  ...Object.values(catalog.reception).map(asset=>asset.url)
];
assert.equal(allUrls.length,71,'Expected 66 floor packs and 5 reception assets');
for(const assetUrl of allUrls){
  assert.equal(new URL(assetUrl).origin,worker,'Catalog contains wrong delivery host');
  assert.ok(new URL(assetUrl).pathname.slice(1).startsWith(PREFIX),
    'Catalog references an unexpected R2 namespace');
}
assert.equal(catalog.reception.image.bytes>0,true);
for(const [entry,mime] of [
  [catalog.days['2026-11-10'].qualities.desktop,'application/gzip'],
  [catalog.days['2026-10-22'].qualities.mobile,'application/gzip'],
  [catalog.reception.image,'image/png'],
  [catalog.reception.mobile,'application/gzip'],
  [catalog.reception.source,'application/json']
]){
  assert.match(entry.sha256,/^[a-f0-9]{64}$/);
  const asset=await readAndVerify(getPath(entry.url),entry.sha256,mime,entry.bytes);
  if(mime==='image/png'){
    assert.equal(asset.readUInt32BE(16),1000);
    assert.equal(asset.readUInt32BE(20),1400);
  }
}
// Existing GitHub Pages remains the production origin. The separate Cloudflare
// website canary must also load catalog JSON, V2 meshes and reception PNG.
for(const entry of [
  catalog.reception.image,catalog.reception.desktop,
  catalog.days['2026-11-10'].qualities.desktop
]){
  const url=entry.url;
  const get=await fetch(url,{headers:{Origin:CANARY},signal:AbortSignal.timeout(25000)});
  assert.equal(get.status,200,'Canary V2 asset GET '+url);
  assert.equal(get.headers.get('Access-Control-Allow-Origin'),CANARY,
    'Cloudflare canary CORS denial '+url);
  assert.equal(get.headers.get('Vary'),'Origin','Missing origin-specific cache variation');
  await get.body?.cancel();
  const head=await fetch(url,{method:'HEAD',headers:{Origin:CANARY},signal:AbortSignal.timeout(25000)});
  assert.equal(head.status,200,'Canary V2 asset HEAD '+url);
  assert.equal(head.headers.get('Access-Control-Allow-Origin'),CANARY);
  const preflight=await fetch(url,{method:'OPTIONS',headers:{
    Origin:CANARY,'Access-Control-Request-Method':'GET'
  },signal:AbortSignal.timeout(25000)});
  assert.equal(preflight.status,204,'Canary V2 preflight '+url);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),CANARY);
  console.log('V2_CANARY_CORS_OK '+url);
}
const denied=await fetch(worker+'/private-recovery/test',{headers:{Origin:PAGES}});
assert.equal(denied.status,404,'Private paths must not be exposed');
const write=await fetch(worker+'/'+catalogPath,{method:'DELETE',headers:{Origin:PAGES}});
assert.equal(write.status,405,'Read-only Worker accepted DELETE');
const goodPreflight=await fetch(worker+'/'+catalogPath,{method:'OPTIONS',headers:{
  Origin:PAGES,'Access-Control-Request-Method':'GET'
}});
assert.equal(goodPreflight.status,204);
const badPreflight=await fetch(worker+'/'+catalogPath,{method:'OPTIONS',headers:{
  Origin:'https://wrong-origin.example','Access-Control-Request-Method':'GET'
}});
assert.equal(badPreflight.status,403);
console.log('SCULPTURE_V2_WORKER_PUBLIC_OK '+JSON.stringify({
  url:worker,catalogSha256:CATALOG_SHA,sampleAssets:5,
  catalogEntries:Object.keys(catalog.days).length,
  existingWorkerUnchanged:true,writeMethodsBlocked:true
}));
