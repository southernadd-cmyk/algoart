import assert from 'node:assert/strict';
import {test} from 'node:test';
import gateway from '../cloudflare/media-read-only/src/worker.mjs';

const host='https://proportion-piece-media.example.workers.dev/';
const pages='https://southernadd-cmyk.github.io';
const h='a'.repeat(64);
const legacy='editions/2026-11-09/2026-11-09-G01/original-'+h+'.jpg';
const release='sculptures-v2/v4.2.1-20261110/';
const good=[
  [legacy,'image/jpeg'],
  [release+'catalog/'+h+'.json','application/json'],
  [release+'floors/2026-11-10/desktop/'+h+'.json.gz','application/gzip'],
  [release+'floors/2026-10-18/mobile/'+h+'.json.gz','application/gzip'],
  [release+'reception/image/'+h+'.png','image/png'],
  [release+'reception/source/'+h+'.json','application/json'],
  [release+'reception/manifest/'+h+'.json','application/json'],
  [release+'reception/desktop/'+h+'.json.gz','application/gzip'],
  [release+'reception/mobile/'+h+'.json.gz','application/gzip']
];
const bytes=Uint8Array.from([1,2,3,4,5,6,7,8]);
function service(){
  const calls=[];
  const known=new Set(good.map(x=>x[0]));
  const item=k=>known.has(k)?{
    size:bytes.length,httpEtag:'"verified"',body:new Response(bytes).body}:null;
  return {calls,env:{MEDIA:{
    async get(k){calls.push(['get',k]);return item(k)},
    async head(k){calls.push(['head',k]);return item(k)}
  }}};
}
function req(path,method='GET',origin=pages,extra={}){
  return new Request(host+path,{method,headers:{Origin:origin,...extra}});
}
test('all previous immutable edition and new V2 key formats have exact MIME, byte length, CORS',async()=>{
  for(const [key,mime] of good){
    const {env,calls}=service();
    const r=await gateway.fetch(req(key),env);
    assert.equal(r.status,200,key);
    assert.equal(r.headers.get('Content-Type'),mime);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'),pages);
    assert.equal(r.headers.get('Content-Length'),String(bytes.length));
    assert.equal(r.headers.get('Cache-Control'),'public, max-age=31536000, immutable');
    assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[...bytes]);
    assert.deepEqual(calls,[['get',key]]);
  }
});
test('HEAD serves verified V2 metadata without reading bodies',async()=>{
  const key=good[2][0],{env,calls}=service();
  const r=await gateway.fetch(req(key,'HEAD'),env);
  assert.equal(r.status,200);
  assert.equal(r.headers.get('Content-Type'),'application/gzip');
  assert.equal((await r.arrayBuffer()).length,0);
  assert.deepEqual(calls,[['head',key]]);
});
test('private backups and all non-whitelisted non-SHA paths are never accessed',async()=>{
  const bad=[
    'sculptures-v2/v4.2.1-20261110/reception/image/'+h+'.jpg',
    release+'floors/2026-11-10/desktop/studies.json.gz',
    release+'floors/2026-11-10/desktop/'+'Z'.repeat(64)+'.json.gz',
    release+'floors/2026-11-10/4k/'+h+'.json.gz',
    release+'floors/2026-12-11/desktop/'+h+'.json',
    release+'catalog/latest.json',
    release+'reception/private/'+h+'.json',
    'sculptures-v2/v4.2.2-20261111/catalog/'+h+'.json',
    'archive-backup/private/'+h+'.json',
    'editions/2026-11-09/../secrets',
    legacy+'?download=1',
    'sculptures-v2/v4.2.1-20261110/catalog/'+h+'.json?download=1'
  ];
  const {env,calls}=service();
  for(const path of bad){
    const res=await gateway.fetch(req(path),env);
    assert.equal(res.status,404,path);
    assert.equal(res.headers.get('Cache-Control'),'no-store');
  }
  assert.deepEqual(calls,[]);
});
test('writes and unauthorised preflight forbidden with no MEDIA access',async()=>{
  const {env,calls}=service();
  for(const method of ['POST','PUT','DELETE']){
    const result=await gateway.fetch(req(good[2][0],method),env);
    assert.equal(result.status,405);
    assert.equal(result.headers.get('Allow'),'GET, HEAD, OPTIONS');
  }
  const yes=await gateway.fetch(req(good[2][0],'OPTIONS',pages,
    {'Access-Control-Request-Method':'GET'}),env);
  assert.equal(yes.status,204);
  const no=await gateway.fetch(req(good[2][0],'OPTIONS','https://hostile.example',
    {'Access-Control-Request-Method':'GET'}),env);
  assert.equal(no.status,403);
  const write=await gateway.fetch(req(good[2][0],'OPTIONS',pages,
    {'Access-Control-Request-Method':'DELETE'}),env);
  assert.equal(write.status,403);
  assert.deepEqual(calls,[]);
});
test('missing R2 binding or missing object safely returns no-store',async()=>{
  const result=await gateway.fetch(req(good[2][0]),{});
  assert.equal(result.status,503);
  const {env}=service();
  const res=await gateway.fetch(req(good[2][0].replace(h,'b'.repeat(64))),env);
  assert.equal(res.status,404);
  assert.equal(res.headers.get('Cache-Control'),'no-store');
});
