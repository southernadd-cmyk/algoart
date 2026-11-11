import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {
  downloadV2Prepared,V2_R2_CATALOG_URL,getV2DailyManifest
} from '../gallery/sculpture-v2-test/v2-pack-loader.mjs';

const date='2026-11-10',quality='desktop';
const pack={
  schema:'pp-sculpture-v2-floor',version:2,complete:true,
  geometryRevision:'v4.2.1-v2-pigment-island-fix',
  date,quality,method:'assembly',
  expectedPortraits:1,bakedPortraits:1,
  studies:{'test.jpg':{seed:'TEST'}}
};
const bytes=gzipSync(Buffer.from(JSON.stringify(pack)));
function localOnly(){
  const seen=[];
  const fetcher=async url=>{
    seen.push(url);
    if(String(url).startsWith('https://'))throw Error('R2 blocked for isolation test');
    return new Response(bytes,{status:200,
      headers:{'Content-Type':'application/gzip'}});
  };
  return{fetcher,seen};
}
test('isolated V2 loader uses R2 first and clearly records verified Pages fallback',async()=>{
  const {fetcher,seen}=localOnly();
  const out=await downloadV2Prepared(date,quality,{
    fetcher,mode:'r2',localBase:'/algoart/gallery/'
  });
  assert.equal(seen[0],V2_R2_CATALOG_URL);
  assert.equal(seen[1],'/algoart/gallery/2026-11-10/3d/v2/sculptures.desktop.json.gz');
  assert.equal(out.studies['test.jpg'].seed,'TEST');
  assert.equal(out.__v2Transport.source,'pages');
  assert.equal(out.__v2Transport.fallback,true);
  assert.match(out.__v2Transport.reason,/R2 blocked/);
  assert.equal(out.__v2Transport.bytes,bytes.byteLength);
  assert.equal(Object.keys(out).includes('__v2Transport'),false);
});
test('isolated V2 loader can force Pages for comparison',async()=>{
  const {fetcher,seen}=localOnly();
  const out=await downloadV2Prepared(date,quality,{
    fetcher,mode:'pages',localBase:'/algoart/gallery/'
  });
  assert.equal(seen.length,1);
  assert.equal(out.__v2Transport.source,'pages');
  assert.equal(out.__v2Transport.fallback,false);
});
test('strict R2 mode fails closed if R2 is unavailable',async()=>{
  const {fetcher,seen}=localOnly();
  await assert.rejects(downloadV2Prepared(date,quality,{
    fetcher,mode:'r2-only',localBase:'/algoart/gallery/'
  }),/R2 blocked/);
  assert.deepEqual(seen,[V2_R2_CATALOG_URL]);
});
test('R2 fallback does not pretend success if Pages is also unavailable',async()=>{
  const fetcher=async url=>String(url).startsWith('https://')
    ?Promise.reject(Error('R2 unreachable'))
    :new Response('missing',{status:404});
  await assert.rejects(downloadV2Prepared(date,quality,{
    fetcher,localBase:'/algoart/gallery/'
  }),/Both V2 sources unavailable.*R2 unreachable/);
});
test('reception uses independent local fallback and always refuses unapproved quality',async()=>{
  const packed=gzipSync(Buffer.from(JSON.stringify({
    ...pack,date:'reception',studies:{'reception.png':{seed:'RECEPTION'}}
  })));
  const calls=[];
  const fetcher=async url=>{
    calls.push(url);
    if(String(url).startsWith('https://'))throw Error('R2 off');
    return new Response(packed,{status:200});
  };
  const out=await downloadV2Prepared('reception','desktop',{
    fetcher,localBase:'/algoart/gallery/'
  });
  assert.equal(out.__v2Transport.fallback,true);
  assert.equal(calls[1],
    '/algoart/gallery/sculpture-v2-test/reception/sculptures.desktop.json.gz');
  await assert.rejects(downloadV2Prepared(date,'print',{
    fetcher,localBase:'/algoart/gallery/'
  }),/Invalid V2 prepared request/);
});


test('future daily V2 loads only its original SHA-checked R2 quality pack',async()=>{
  const day='2026-11-11',quality='desktop';
  const original={...pack,date:day};
  const zip=gzipSync(Buffer.from(JSON.stringify(original)));
  const sha=createHash('sha256').update(zip).digest('hex');
  const base='https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev';
  const manifest={
    schema:'pp-sculpture-v2-daily-r2-manifest',version:1,
    revision:'v4.2.1-v2-pigment-island-fix',date:day,portraits:1,
    worker:base,ready:true,confluenceExcluded:true,
    metaSha256:'a'.repeat(64),v1Sha256:'b'.repeat(64),
    qualities:{
      desktop:{sha256:sha,bytes:zip.length,
        url:base+'/sculptures-v2/daily/v4.2.1/'+day+'/desktop/'+sha+'.json.gz'},
      mobile:{sha256:'c'.repeat(64),bytes:zip.length,
        url:base+'/sculptures-v2/daily/v4.2.1/'+day+'/mobile/'+
          'c'.repeat(64)+'.json.gz'}
    }
  };
  const urls=[];
  const fetcher=async url=>{
    urls.push(String(url));
    if(String(url).endsWith('/manifest.json'))
      return new Response(JSON.stringify(manifest),{status:200});
    if(String(url)===manifest.qualities.desktop.url)
      return new Response(zip,{status:200});
    throw Error('Unapproved source requested: '+url);
  };
  const out=await downloadV2Prepared(day,quality,{
    fetcher,mode:'r2-only',localBase:'/algoart/gallery/'
  });
  assert.equal(out.date,day);
  assert.equal(out.__v2Transport.source,'r2');
  assert.equal(out.__v2Transport.bytes,zip.length);
  assert.deepEqual(urls,[
    base+'/sculptures-v2/daily/v4.2.1/2026-11-11/manifest.json',
    manifest.qualities.desktop.url
  ]);
  const tampered=async url=>String(url).endsWith('/manifest.json')
    ?new Response(JSON.stringify(manifest),{status:200})
    :new Response(Buffer.from('not the signed sculpture'),{status:200});
  await assert.rejects(downloadV2Prepared(day,quality,{
    fetcher:tampered,mode:'r2-only',localBase:'/algoart/gallery/'
  }),/SHA-256 mismatch/);
  const forged=async url=>new Response(JSON.stringify({
    ...manifest,qualities:{...manifest.qualities,
      desktop:{...manifest.qualities.desktop,
        url:'https://wrong-host.example/file.gz'}}
  }),{status:200});
  await assert.rejects(getV2DailyManifest(day,{fetcher:forged}),
    /Daily V2 manifest has invalid desktop link/);
});
