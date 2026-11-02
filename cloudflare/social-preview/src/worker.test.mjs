import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

const fields=['v','seed','mode','fmt','el','den','cx','neg','phi','rec','spi','ga','nest','pen','th','wob','od','op','pr','dry','curve','shape','overlap','rot','ln','ci','re','po','ar','pal','cols','sat','bri','paper','grain','sheet','material','fit','tissue','watercolor'];
const token=Buffer.from(fields.map(k=>({v:'9',seed:'WORKER-TEST',mode:'rects',fmt:'landscape'})[k]||'').join('\x1f')).toString('base64url');
const endpoint='https://example.workers.dev/share/preload?c='+token;
const origin='https://southernadd-cmyk.github.io';
const jpeg=Buffer.alloc(4100);
jpeg[0]=0xff;jpeg[1]=0xd8;
jpeg[2]=0xff;jpeg[3]=0xc0;jpeg[4]=0;jpeg[5]=7;jpeg[6]=8;
jpeg.writeUInt16BE(630,7);jpeg.writeUInt16BE(1200,9);
jpeg[jpeg.length-2]=0xff;jpeg[jpeg.length-1]=0xd9;
const post=()=>new Request(endpoint,{method:'POST',headers:{origin,'content-type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({jpeg:jpeg.toString('base64')})});
const makeEnv=({existing=false}={})=>{
 const writes=[];
 return {writes,PREVIEW_KV:{async get(){return existing?new ArrayBuffer(4100):null},async put(key,value){writes.push({key,size:value.byteLength})}}};
};

test('rejects non-browser origin before storage access',async()=>{
 const env=makeEnv();
 const request=new Request(endpoint,{method:'POST',headers:{origin:'https://attacker.example'}});
 assert.equal((await worker.fetch(request,env)).status,403);
 assert.equal(env.writes.length,0);
});



test('a valid first upload stores exactly one card',async()=>{
 const env=makeEnv();
 const response=await worker.fetch(post(),env);
 assert.equal(response.status,200);
 assert.equal(env.writes.length,1);
 assert.equal(env.writes[0].key,'previews/'+token+'.jpg');
});

test('an existing card is not overwritten',async()=>{
 const env=makeEnv({existing:true});
 const response=await worker.fetch(post(),env);
 assert.equal(response.status,200);
 assert.equal((await response.json()).existing,true);
 assert.equal(env.writes.length,0);
});


