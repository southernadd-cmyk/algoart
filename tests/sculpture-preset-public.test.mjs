import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {fetchVerifiedSculpture} from '../automation/verify-sculpture-preset.mjs';
const bytes=Buffer.from('the exact published source');
const sha=createHash('sha256').update(bytes).digest('hex');
const spec={url:'https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev/sculptures-v2/assembly-20261117/catalog/'+sha+'.json',sha256:sha,bytes:bytes.length};
const response=body=>new Response(body,{headers:{'access-control-allow-origin':'https://southernadd-cmyk.github.io','content-type':'application/json'}});
test('public reads verify original bytes and CORS without changing the request origin',async()=>{
 const seen=[];
 const fetcher=async(url,options)=>{seen.push([url,options.headers.Origin]);return response(bytes)};
 assert.deepEqual(await fetchVerifiedSculpture(spec,{fetcher}),bytes);
 assert.deepEqual(seen,[[spec.url,'https://southernadd-cmyk.github.io']]);
 await assert.rejects(fetchVerifiedSculpture(spec,{fetcher:async()=>response('changed')}),/SHA-256 mismatch/);
 await assert.rejects(fetchVerifiedSculpture({...spec,bytes:99},{fetcher:async()=>response(bytes)}),/byte length mismatch/);
 await assert.rejects(fetchVerifiedSculpture({...spec,url:'https://wrong.example/file.json'},{fetcher}),/Unapproved sculpture source/);
 await assert.rejects(fetchVerifiedSculpture(spec,{fetcher:async()=>new Response('outage',{status:503})}),/HTTP 503/);
});
