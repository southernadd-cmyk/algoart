import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyPublicSplat} from '../automation/verify-sculpture-splat-public.mjs';
const data=Buffer.from('fixture'),sha256=createHash('sha256').update(data).digest('hex');
const key='sculptures-splats/v1/assembly-20261117/reception/mobile/'+sha256+'.json.gz';
const item={key,url:'https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev/'+key,bytes:data.length,sha256,contentType:'application/gzip'};
const headers={'content-type':item.contentType,'access-control-allow-origin':'https://southernadd-cmyk.github.io','content-length':String(data.length)};
test('public verifier requires GET bytes and HEAD headers for exact approved origin',async()=>{
 const methods=[];
 await verifyPublicSplat(item,{fetcher:async(url,options)=>{
  assert.equal(url,item.url);assert.equal(options.redirect,'error');assert.equal(options.headers.Origin,headers['access-control-allow-origin']);
  methods.push(options.method);
  return new Response(options.method==='GET'?data:null,{status:200,headers});
 }});
 assert.deepEqual(methods,['GET','HEAD']);
});
test('public verifier rejects wrong bytes, missing CORS and unsuccessful HEAD',async()=>{
 await assert.rejects(verifyPublicSplat(item,{fetcher:async()=>new Response('changed',{status:200,headers})}),/SHA-256/);
 await assert.rejects(verifyPublicSplat(item,{fetcher:async()=>new Response(data,{status:200,headers:{...headers,'access-control-allow-origin':'*'}})}),/headers mismatch/);
 await assert.rejects(verifyPublicSplat(item,{fetcher:async(url,{method})=>method==='GET'?new Response(data,{status:200,headers}):new Response(null,{status:403})}),/HEAD HTTP 403/);
});
test('public verifier will not fetch a forged URL or mismatched hash',async()=>{
 for(const invalid of [{...item,url:'https://example.com/private'},{...item,sha256:'a'.repeat(64)}]){
  await assert.rejects(verifyPublicSplat(invalid,{fetcher:async()=>assert.fail('Unexpected fetch')}),/descriptor/);
 }
});
