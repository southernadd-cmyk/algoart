import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import worker,{testing} from '../src/worker.mjs';
const keys=['v','seed','mode','fmt','el','den','cx','neg','phi','rec','spi','ga',
'nest','pen','th','wob','od','op','pr','dry','curve','shape','overlap','rot','ln',
'ci','re','po','ar','pal','cols','sat','bri','paper','grain','sheet','material',
'fit','tissue','watercolor'];
const values={v:'9',seed:'TEST-SEED-1',mode:'rects',material:'oil-v4'};
const token=Buffer.from(keys.map(k=>values[k]||'').join('\x1f')).toString('base64url');
const base='https://proportion-piece-social.example.workers.dev';
const map=new Map();
const kv={
 async put(k,b){map.set(k,b)},
 async get(k,mode){assert.equal(mode,'arrayBuffer');return map.get(k)||null}
};
const env={PREVIEW_KV:kv};
function request(path,init){return new Request(base+path,init)}
test('compact share token retains historic revision and rejects mutation',()=>{
 assert.equal(testing.decodeToken(token).material,'oil-v4');
 assert.equal(testing.decodeToken('bogus'),null);
});
test('Oil V5 compact links retain the pigment revision and oil metadata',async()=>{
 const data={...values,material:'oil-v5'};
 const v5=Buffer.from(keys.map(k=>data[k]||'').join('\x1f')).toString('base64url');
 assert.equal(testing.decodeToken(v5).material,'oil-v5');
 const response=await worker.fetch(request('/share?c='+v5),env);
 assert.equal(response.status,200);assert.match(await response.text(),/Original Oil Paint composition/);
});
test('Oil V8 compact links identify the artwork as Oil Paint',async()=>{
 const data={...values,material:'oil-v8'};
 const v8=Buffer.from(keys.map(k=>data[k]||'').join('\x1f')).toString('base64url');
 assert.equal(testing.decodeToken(v8).material,'oil-v8');
 const response=await worker.fetch(request('/share?c='+v8),env);
 assert.equal(response.status,200);
 assert.match(await response.text(),/Original Oil Paint composition/);
});
test('Action V3 compact links retain their exact renderer and paint metadata',async()=>{
 const data={...values,material:'action-v3'};
 const v3=Buffer.from(keys.map(k=>data[k]||'').join('\x1f')).toString('base64url');
 assert.equal(testing.decodeToken(v3).material,'action-v3');
 const response=await worker.fetch(request('/share?c='+v3),env);
 assert.equal(response.status,200);assert.match(await response.text(),/Original Action Painting composition/);
});
test('social HTML is crawler-visible and keeps exact token',async()=>{
 const r=await worker.fetch(request('/share?c='+token+'&pv=2'),env);
 assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/property="og:image"/);
 assert.match(html,/&amp;pv=2/);
 assert.match(html,/location.replace/);
 assert.match(html,/PROPORTION PIECE/);
 assert(!html.includes('onrender.com'));
});
test('missing images 404, invalid uploads rejected, CORS honoured',async()=>{
 const missing=await worker.fetch(request('/share/image?c='+token),env);
 assert.equal(missing.status,404);
 const bad=await worker.fetch(request('/share/preload?c='+token,{
 method:'POST',headers:{Origin:'https://untrusted.test','Content-Type':'application/json'},
 body:JSON.stringify({jpeg:'bad'})
 }),env);
 assert.equal(bad.status,403);
 const invalid=await worker.fetch(request('/share/preload?c='+token,{
 method:'POST',headers:{Origin:'https://southernadd-cmyk.github.io','Content-Type':'application/json'},
 body:JSON.stringify({jpeg:'bad'})
 }),env);
 assert.equal(invalid.status,400);
});
test('health works without a KV namespace',async()=>{
 assert.equal((await worker.fetch(request('/health'),{})).status,200);
});

test('portrait OG metadata reflects orientation',async()=>{
 const portraitToken=Buffer.from(keys.map(k=>k==='fmt'?'portrait':values[k]||'').join('\\x1f').replaceAll('\\x1f','\x1f')).toString('base64url');
 const response=await worker.fetch(request('/share?c='+portraitToken),env);
 const html=await response.text();
 assert.match(html,/og:image:width\" content=\"1200\"/);
 assert.match(html,/og:image:height\" content=\"630\"/);
});


// Keep the Worker in sync with editor renderer releases; protect future V11 upgrades.
test('latest editor renderer version has a working social thumbnail route',async()=>{
 const settingsSource=readFileSync(new URL('../../../js/settings-url.js',import.meta.url),'utf8');
 const match=settingsSource.match(/A\.SUPPORTED_RENDERER_VERSIONS=Object\.freeze\((\[[^\]]+\])\)/);
 assert(match,'Cannot read the editor renderer version list');
 const latest=Math.max(...JSON.parse(match[1]));
 const vToken=Buffer.from(keys.map(k=>({...values,v:String(latest),material:'oil-v8'})[k]||'').join('\x1f')).toString('base64url');
 assert.equal(testing.decodeToken(vToken)?.v,String(latest),
   'Cloudflare must accept the current editor renderer version');
 const card=await worker.fetch(request('/share?c='+vToken),env);
 assert.equal(card.status,200);
 assert.match(await card.text(),/property="og:image"/);
});
