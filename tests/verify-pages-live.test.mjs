import test from 'node:test';
import assert from 'node:assert/strict';
import {checkLiveStatic,STATIC_PROBES} from '../automation/verify-pages-live.mjs';
const bytes = Buffer.from('the-current-version');
const read = async () => bytes;
const response = data => ({ok:true,arrayBuffer:async()=>Uint8Array.from(data).buffer});

test('monitors production HTML, sculpture scripts, gallery archive and Confluence',()=>{
  for(const file of ['index.html','gallery/index.html','gallery/archive.json','gallery/sculpture-lab/lab-v2.mjs','confluence/index.html'])
    assert.ok(STATIC_PROBES.includes(file),file);
});
test('verifies exact bytes of all published static entrypoints',async()=>{
  const requests=[];
  const request=async url=>{requests.push(url);return response(bytes);};
  const result=await checkLiveStatic({baseUrl:'https://example.test/algoart/',paths:['index.html','gallery/sculpture-lab/index.html'],read,request,attempts:1});
  assert.equal(result.ok,true);assert.equal(requests.length,2);
  assert.match(requests[1],/\/algoart\/gallery\/sculpture-lab\/index.html\?pp-verify=/);
});
test('retries stale and missing assets then succeeds',async()=>{
  let attempts=0;let sleeps=0;
  const request=async()=>{attempts++;return attempts===1?{ok:false,status:404}:response(bytes)};
  const result=await checkLiveStatic({baseUrl:'https://example.test/algoart/',paths:['index.html'],read,request,attempts:2,sleep:async()=>{sleeps++}});
  assert.equal(result.ok,true);assert.equal(sleeps,1);
});
test('a successfully uploaded artifact is still failed if production remains stale',async()=>{
  await assert.rejects(checkLiveStatic({baseUrl:'https://example.test/algoart/',paths:['index.html'],read,request:async()=>response(Buffer.from('old')),attempts:2,sleep:async()=>{}}),/did not serve the deployed release/);
});
test('fails closed on a missing expected file or insecure destination',async()=>{
  await assert.rejects(checkLiveStatic({baseUrl:'http://example.test/',paths:['foo'],read,request:async()=>response(bytes),attempts:1}),/Only HTTPS/);
  await assert.rejects(checkLiveStatic({baseUrl:'https://example.test/',paths:['missing'],read:async()=>{throw Error('ENOENT')},request:async()=>response(bytes),attempts:1}),/ENOENT/);
});
