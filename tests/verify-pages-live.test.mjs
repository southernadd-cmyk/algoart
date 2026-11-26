import test from 'node:test';
import assert from 'node:assert/strict';
import {checkLiveStatic,STATIC_PROBES} from '../automation/verify-pages-live.mjs';
const bytes = Buffer.from('the-current-version');
const read = async () => bytes;
const response = data => ({ok:true,arrayBuffer:async()=>Uint8Array.from(data).buffer});

test('monitors production HTML, sculpture scripts, gallery archive and Confluence',()=>{
  for(const file of ['index.html','gallery/index.html','gallery/archive.json','gallery/sculpture-lab/lab-v2.mjs','gallery/gaussian-splat-lab/index.html','confluence/index.html'])
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

test('Gaussian lab includes Spark documented addons prefix and repairs Confluence portrait slots',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {repairPortraitSlots,isSoloPortrait}=await import('../gallery/gaussian-splat-lab/portrait-slots.mjs');
  const builder=await readFile(new URL('../automation/build-sculpture-v2-test.mjs',import.meta.url),'utf8');
  const html=await readFile(new URL('../gallery/gaussian-splat-lab/index.html',import.meta.url),'utf8');
  assert.match(html,/tower\.html/);
  assert.ok(builder.includes("'three/addons/':'https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/'"));
  assert.ok(builder.includes("three:'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js'"));
  assert.ok(builder.includes("external:['three','three/*','@sparkjsdev/spark']"));
  assert.ok(builder.includes('if(solo(sa)!==solo(sb))return false;'));
  const meta=JSON.parse(await readFile(new URL('../gallery/2026-11-26/meta.json',import.meta.url),'utf8'));
  const studies=meta.entries.map(e=>({id:e.id,portrait:e.orientation==='portrait',aspect:e.orientation==='portrait'?1/1.4:1.4,material:{type:e.material}}));
  const exhibition={paintings:studies.filter(s=>!isSoloPortrait(s)).map(s=>({studyId:s.id,width:s.aspect*2,height:2})),sculptures:studies.filter(isSoloPortrait).map(s=>({studyId:s.id}))};
  assert.equal(exhibition.paintings.length,8);assert.equal(exhibition.sculptures.length,6);
  const a=exhibition.paintings.find(p=>p.studyId==='2026-11-26-C01'),b=exhibition.sculptures[0];
  [a.studyId,b.studyId]=[b.studyId,a.studyId];
  assert.equal(repairPortraitSlots(exhibition,studies),1);
  assert.ok(exhibition.paintings.some(p=>p.studyId==='2026-11-26-C01'));
  assert.ok(exhibition.sculptures.every(p=>isSoloPortrait(studies.find(s=>s.id===p.studyId))));
  assert.equal(repairPortraitSlots(exhibition,studies),0);
});
