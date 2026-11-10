#!/usr/bin/env node
// Post-deploy gate: artifact upload success is not a verified live release.
// These are committed static entry points; CI-built bundles have separate checks.
// Daily R2 media receives its existing canary-specific verification.
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const STATIC_PROBES = [
  'index.html',
  'gallery/index.html',
  'gallery/archive.json',
  'gallery/visit/index.html',
  'gallery/sculpture-lab/index.html',
  'gallery/sculpture-lab/lab-v2.mjs',
  'gallery/sculpture-lab/sculpture-v2-engines.mjs',
  'confluence/index.html'
];
const SITE = 'https://southernadd-cmyk.github.io/algoart/';

export async function checkLiveStatic({
  baseUrl=SITE, paths=STATIC_PROBES, read=readFile, request=fetch,
  attempts=24, pauseMs=5000, sleep=delay, nonce='live-release'
}={}) {
  if (!baseUrl.startsWith('https://')) throw Error('Only HTTPS live deployment verification is supported');
  const expected = await Promise.all(paths.map(async p => ({p, bytes: await read(p)})));
  let latest = [];
  for (let attempt=1;attempt<=attempts;attempt++) {
    latest=[];
    for (const {p,bytes} of expected) {
      try {
        const u=new URL(p,baseUrl);
        u.searchParams.set('pp-verify',`${nonce}-${attempt}`);
        const res=await request(u.toString(), {redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
        if(!res.ok){latest.push(`${p}: HTTP ${res.status}`);continue;}
        const received=Buffer.from(await res.arrayBuffer());
        if(!received.equals(bytes)) latest.push(`${p}: served ${received.length} bytes, expected ${bytes.length}`);
      } catch(error){ latest.push(`${p}: ${error.message}`); }
    }
    if(latest.length===0) {
      console.log(`PAGES LIVE VERIFIED: ${paths.length} paths match release files (attempt ${attempt})`);
      return {ok:true,paths};
    }
    console.warn(`Pages propagation check ${attempt}/${attempts}: ${latest.join('; ')}`);
    if(attempt<attempts)await sleep(pauseMs);
  }
  throw Error(`Pages did not serve the deployed release after ${attempts} attempts: ${latest.join('; ')}`);
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  await checkLiveStatic({nonce:process.env.GITHUB_SHA?.slice(0,12)||'manual'});
}
