import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {buildSplatPack,sha256} from '../automation/lib/sculpture-splat-pack.mjs';
import {SPLAT_GEOMETRY_REVISION as revision,SPLAT_ALGORITHM as algorithm,SPLAT_BUDGETS as budgets} from '../gallery/sculpture-splats/format.mjs';
import {downloadSplatPack,validateSplatManifest,SPLAT_R2_ORIGIN as worker,SPLAT_R2_PREFIX as prefix} from '../gallery/sculpture-splats/r2-loader.mjs';
const date='reception',name='source.jpg',sourceSha256='a'.repeat(64);
const mesh={position:[0,0,0],rotation:[0,0,0,'XYZ'],scale:[1,1,1],materials:[{}],geometry:{
 position:[0,0,0,100000,0,0,0,100000,0],normal:[0,0,10000,0,0,10000,0,0,10000],uv:[0,0,100000,0,0,100000],index:[0,1,2],groups:[{start:0,count:3,materialIndex:0}]
}};
function fixture(){
 const manifest={schema:'pp-sculpture-splats-r2-manifest',version:1,algorithm,geometryRevision:revision,date,
 presetId:'assembly-100-100-40-95',worker,ready:true,portraits:1,studies:{[name]:'seed'},qualities:{}};
 const files=new Map();
 function add(quality,bytes){
  const sha=sha256(bytes),url=worker+'/'+prefix+'/'+date+'/'+quality+'/'+sha+'.json.gz';
  files.set(url,bytes);manifest.qualities[quality]={sha256:sha,url,bytes:bytes.length,sourceSha256,pointsPerStudy:budgets[quality]};
 }
 for(const quality of ['mobile','desktop']){
  const study={schema:'pp-sculpture-v2-study',version:2,seed:'seed',imageFile:name,sourceFile:name,quality,method:'assembly',geometryRevision:revision,coverage:1,omittedCells:0,regionCount:1,triangleCount:1,meshes:[mesh]};
  const source={schema:'pp-sculpture-v2-floor',version:2,date,quality,complete:true,method:'assembly',geometryRevision:revision,expectedPortraits:1,studies:{[name]:study}};
  add(quality,buildSplatPack(source,{date,quality,sourceSha256}).bytes);
 }
 const fetcher=async url=>url.endsWith('/manifest.json')?Response.json(manifest):files.has(url)?new Response(files.get(url)):new Response('',{status:404});
 return {manifest,files,fetcher,add};
}
test('GS2 verifies both quality packs and decodes original source records',async()=>{
 const f=fixture();
 for(const quality of ['mobile','desktop']){
  const pack=await downloadSplatPack(date,quality,{fetcher:f.fetcher,sourceSha256});
  assert.ok(pack.studies[name].points instanceof Float32Array);
  assert.equal(pack.studies[name].points.length,budgets[quality]*11);
 }
});
test('GS2 rejects missing or stale source identity, wrong host, altered bytes, and corrupt records',async()=>{
 const f=fixture(),options={fetcher:f.fetcher,sourceSha256};
 await assert.rejects(downloadSplatPack(date,'mobile',{...options,sourceSha256:'b'.repeat(64)}),/mesh source/);
 await assert.rejects(downloadSplatPack(date,'mobile',{fetcher:f.fetcher}),/source hash/);
 const good=f.manifest.qualities.mobile.url;
 const bad=structuredClone(f.manifest);bad.qualities.mobile.url='https://example.com/file.gz';
 assert.throws(()=>validateSplatManifest(bad,date),/Unapproved/);
 const original=f.files.get(good);const corrupt=Buffer.from(original);corrupt[20]^=1;f.files.set(good,corrupt);
 await assert.rejects(downloadSplatPack(date,'mobile',options),/SHA-256/);
 const {gunzipSync}=await import('node:zlib');
 const pack=JSON.parse(gunzipSync(original));pack.studies[name].pointsSha256='b'.repeat(64);
 f.add('mobile',gzipSync(JSON.stringify(pack)));
 await assert.rejects(downloadSplatPack(date,'mobile',options),/point SHA-256/);
});
