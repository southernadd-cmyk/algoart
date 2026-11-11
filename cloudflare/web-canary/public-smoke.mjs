#!/usr/bin/env node
// Public-read-only smoke test. Never sends deployment or publishing requests.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const origin='https://proportion-piece-web-canary.mr-adam-clement.workers.dev';
const base=origin+'/algoart/';
const paths=[
  ['','index.html'],
  ['confluence/','confluence/index.html'],
  ['gallery/','gallery/index.html'],
  ['gallery/archive.json','gallery/archive.json'],
  ['gallery/2026-11-11/','gallery/2026-11-11/index.html'],
  ['gallery/2026-11-11/meta.json','gallery/2026-11-11/meta.json'],
  ['gallery/visit/','gallery/visit/index.html'],
  ['gallery/visit/gallery-phi-bundle.js','gallery/visit/gallery-phi-bundle.js'],
  ['gallery/sculpture-lab/','gallery/sculpture-lab/index.html'],
  ['gallery/sculpture-lab/lab-v2.mjs','gallery/sculpture-lab/lab-v2.mjs'],
  ['gallery/sculpture-v2-test/','gallery/sculpture-v2-test/index.html'],
  ['css/style.css','css/style.css'],
  ['js/generator.js','js/generator.js']
];
for (const [route,relative] of paths) {
  const u=new URL(route,base);
  u.searchParams.set('pp-canary-readonly',process.env.GITHUB_SHA?.slice(0,10)||'smoke');
  const response=await fetch(u,{redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200,'Canary route failed '+u+': '+response.status);
  const actual=Buffer.from(await response.arrayBuffer());
  const expected=readFileSync(join('_cf_assets','algoart',relative));
  assert.ok(actual.equals(expected),'Canary byte mismatch: '+relative+' remote '+actual.length+' local '+expected.length);
  console.log('LIVE_CANARY_PARITY_OK '+relative+' ('+actual.length+' bytes)');
}
const missing=await fetch(base+'no-such-route-20261111',{signal:AbortSignal.timeout(15000)});
assert.equal(missing.status,404,'Unknown canary URL must not fall back into live site');
console.log('LIVE_CANARY_404_OK');

const video=base+'gallery/visit/touchdesigner/bank-two/six-screen-installation.webm';
const ranged=await fetch(video,{headers:{Range:'bytes=0-99'},signal:AbortSignal.timeout(25000)});
console.log('LIVE_CANARY_VIDEO_RANGE '+ranged.status+' content-range='+ranged.headers.get('content-range'));
await ranged.body?.cancel();
if (ranged.status!==206) console.warn('RELEASE_BLOCKER: video/media range requests do not return HTTP 206; Safari compatibility unverified');

const meta=JSON.parse(readFileSync('_cf_assets/algoart/gallery/2026-11-11/meta.json','utf8'));
assert.equal(meta.count,14,'Wrong frozen 11 November archive count');
const original=meta.entries[0]?.media?.original;
assert.ok(original?.startsWith('https://proportion-piece-media.mr-adam-clement.workers.dev/'),'Missing R2 artwork origin');
const media=await fetch(original,{headers:{Origin:origin},signal:AbortSignal.timeout(25000)});
const acao=media.headers.get('access-control-allow-origin');
console.log('LIVE_CANARY_R2_CORS '+JSON.stringify({status:media.status,accessControlAllowOrigin:acao,expected:origin}));
await media.body?.cancel();
assert.equal(media.status,200,'R2 original failed');
assert.ok(acao==='*'||acao===origin,'R2 image CORS blocks cross-origin access from new canary; do not cut over');
console.log('LIVE_CANARY_HTTP_SMOKE_PASSED');
