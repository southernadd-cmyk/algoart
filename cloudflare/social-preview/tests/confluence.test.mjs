import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker.mjs';
import {testing} from '../src/confluence.mjs';
const origin='https://southernadd-cmyk.github.io';
const base='https://proportion-piece-social.example.workers.dev';
const settings={elements:42,colourCount:6,opacity:80,fit:false,seed:''};
const state={
 v:1,seed:'CONFLUENCE-SEED',orientation:'portrait',paper:'#f5f0e6',grain:11,
 response:'weave',strength:75,collaborationPull:100,totalTurns:13,
 artists:[
  {system:'field',palette:'signature',material:'marker',settings},
  {system:'rects',palette:'signature',material:'watercolour',settings},
  {system:'organic',palette:'signature',material:'oil',settings}
 ]
};
function jpeg(){
 const b=Buffer.alloc(4100);
 b[0]=0xff;b[1]=0xd8;b[2]=0xff;b[3]=0xc0;b[4]=0;b[5]=7;b[6]=8;
 b.writeUInt16BE(630,7);b.writeUInt16BE(1200,9);
 b[b.length-2]=0xff;b[b.length-1]=0xd9;
 return b.toString('base64');
}
function kv(){
 const map=new Map();
 return {map,
 PREVIEW_KV:{
  async put(k,value){map.set(k,value)},
  async get(k,mode){return map.has(k)?map.get(k):null}
 }};
}
const upload=(s=state,org=origin)=>new Request(base+'/confluence/preload',{method:'POST',
 headers:{origin:org,'content-type':'application/json'},
 body:JSON.stringify({state:s,jpeg:jpeg()})});
test('Confluence state accepts three voices, portrait, and Fibonacci turn counts',()=>{
 assert(testing.validateState(state));
 assert(!testing.validateState({...state,totalTurns:12}));
 assert(!testing.validateState({...state,artists:state.artists.slice(0,2)}));
 assert(!testing.validateState({...state,seed:'<script>alert(1)</script>'}));
 assert(!testing.validateState({...state,artists:state.artists.map(a=>({...a,material:'invalid'}))}));
});
test('Worker stores exact Confluence state and canvas image under short link',async()=>{
 const env=kv();
 const res=await worker.fetch(upload(),env);
 assert.equal(res.status,200);
 const result=await res.json();
 assert.match(result.url,/\/confluence\/share\?id=[a-f0-9]{24}/);
 assert.equal(env.map.size,2);
 const card=await worker.fetch(new Request(result.url),env);
 assert.equal(card.status,200);
 const html=await card.text();
 assert.match(html,/Confluence — PROPORTION PIECE/);
 assert.match(html,/og:image/);
 assert.match(html,/summary_large_image/);
 assert.match(html,/\/algoart\/confluence\/\?s=/);
 const preview=await worker.fetch(new Request(result.url.replace('share','image')),env);
 assert.equal(preview.status,200);
 assert.equal(preview.headers.get('content-type'),'image/jpeg');
});
test('No social card for invalid IDs or missing preview records',async()=>{
 const env=kv();
 assert.equal((await worker.fetch(new Request(base+'/confluence/share?id=broken'),env)).status,400);
 assert.equal((await worker.fetch(new Request(base+'/confluence/share?id='+'a'.repeat(24)),env)).status,404);
});
test('Invalid or third-party uploads are refused before storage',async()=>{
 const env=kv();
 assert.equal((await worker.fetch(upload(state,'https://attacker.invalid'),env)).status,403);
 assert.equal((await worker.fetch(upload({...state,totalTurns:12}),env)).status,400);
 assert.equal(env.map.size,0);
});
test('The Confluence image preview remains identical to the uploaded JPEG',async()=>{
 const env=kv();
 const initial=await worker.fetch(upload(),env);
 const url=(await initial.json()).url.replace('share','image');
 const body=await worker.fetch(new Request(url),env);
 const output=Buffer.from(await body.arrayBuffer());
 assert.equal(output.compare(Buffer.from(jpeg(),'base64')),0);
});
