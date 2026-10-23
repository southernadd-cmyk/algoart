import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base='https://proportion-piece-social.mr-adam-clement.workers.dev';
const keys=['v','seed','mode','fmt','el','den','cx','neg','phi','rec','spi','ga','nest','pen','th','wob','od','op','pr','dry','curve','shape','overlap','rot','ln','ci','re','po','ar','pal','cols','sat','bri','paper','grain','sheet','material','fit','tissue','watercolor'];
const params={v:'9',seed:'CLOUDFLARE-SMOKE-20261023',mode:'rects',material:'oil-v4'};
const token=Buffer.from(keys.map(k=>params[k]||'').join('\x1f')).toString('base64url');
async function get(path,init){
  const r=await fetch(base+path,{signal:AbortSignal.timeout(15000),...init});
  return r;
}
const health=await get('/health');
assert.equal(health.status,200,'Cloudflare health must return 200');
assert.equal((await health.json()).service,'proportion-piece-social');
const landing=await get('/share?c='+token+'&pv=2',{headers:{'User-Agent':'facebookexternalhit/1.1'},redirect:'manual'});
assert.equal(landing.status,200,'Crawler OG response must return 200');
const html=await landing.text();
assert.match(html,/property="og:image"/);
assert.match(html,/CLOUDFLARE-SMOKE-20261023/);
assert.match(html,/proportion-piece-social\.mr-adam-clement\.workers\.dev\/share\/image/);
assert.match(html,/&amp;pv=2/);
assert(!html.includes('onrender.com'));
const absent=await get('/share/image?c='+token);
assert.equal(absent.status,404,'Unuploaded image should return safe 404, not fake artwork');
const cors=await get('/share/preload?c='+token,{method:'OPTIONS',headers:{
  Origin:'https://southernadd-cmyk.github.io','Access-Control-Request-Method':'POST'
}});
assert.equal(cors.status,204,'Legacy published origin must be accepted');
assert.equal(cors.headers.get('access-control-allow-origin'),'https://southernadd-cmyk.github.io');
const forbidden=await get('/share/preload?c='+token,{method:'OPTIONS',headers:{Origin:'https://untrusted.example'}});
assert.equal(forbidden.status,403);
console.log('PASS Cloudflare public health, OG preview, missing image, permitted and rejected CORS');

const jpeg=readFileSync('/tmp/proportion-piece-cloudflare-ci.jpg');
assert(jpeg.length>4000 && jpeg.length<285000,'Fixture must satisfy actual upload limits');
const uploaded=await get('/share/preload?c='+token,{method:'POST',headers:{
  'Origin':'https://southernadd-cmyk.github.io','Content-Type':'application/json'
},body:JSON.stringify({jpeg:jpeg.toString('base64')})});
assert.equal(uploaded.status,200,'Real JPEG upload to Cloudflare KV must succeed: '+await uploaded.text());
// Cloudflare KV is eventually consistent across PoPs. Test within the
// documented propagation window, not immediately after PUT.
let roundtrip;
for(let attempt=0;attempt<18;attempt++){
  roundtrip=await get('/share/image?c='+token);
  if(roundtrip.status===200)break;
  assert.equal(roundtrip.status,404,'Unexpected response while KV propagates');
  await new Promise(resolve=>setTimeout(resolve,5000));
}
assert.equal(roundtrip.status,200,'KV image still missing after 90-second propagation window');
assert.match(roundtrip.headers.get('content-type')||'',/image\/jpeg/);
assert.deepEqual(Buffer.from(await roundtrip.arrayBuffer()),jpeg,'Stored JPEG bytes must be exact');
console.log('PASS real JPEG upload and Cloudflare KV byte-for-byte roundtrip');
