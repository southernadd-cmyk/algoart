import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {patchN8AOTest} from '../automation/phi-n8ao-test-plugin.mjs';
const original=readFileSync('gallery/visit/phi-post-fx.mjs','utf8');
const patched=patchN8AOTest(original);
test('test transform retains the approved presets and artwork protection',()=>{
 const defaults=s=>s.slice(s.indexOf('export const PHI_FX_DEFAULTS'),s.indexOf('export function phiFXSettings'));
 assert.equal(defaults(patched),defaults(original));
 assert.match(patched,/compositor.addPass\(artProtection.pass\)/);
 assert.match(original,/N8AOPostPass/);
 assert.match(original,/if\(production\)panel.hidden=true/);
 assert.match(patched,/panel.hidden=false/);
});
test('AO providers are mutually exclusive, and comparison resets timing history',()=>{
 const enabled=patched.match(/e.normals.enabled=e.aoPass.enabled=.*;\n  e.n8ao.enabled=.*;/)[0];
 for(const provider of ['ssao','n8ao'])for(const intensity of [0,1.2]){
  const e={normals:{},aoPass:{},n8ao:{}};
  Function('e','s','aoProvider',enabled)(e,{aoIntensity:intensity},provider);
  assert.equal(e.normals.enabled,e.aoPass.enabled);
  assert.equal(Number(e.aoPass.enabled)+Number(e.n8ao.enabled),intensity>0?1:0);
 }
 assert.match(patched,/for\(const bucket of Object.values\(frames\)\)bucket.length=0/);
 assert.match(patched,/ao:stats.aoConfiguration/);
});
test('upscaling and linear colour are explicit; plugin rejects stale source anchors',()=>{
 assert.match(patched,/depthAwareUpsampling=true/);
 assert.match(patched,/gammaCorrection=false/);
 assert.match(patched,/configuration.accumulate=false/);
 assert.throws(()=>patchN8AOTest('changed source'),/anchor changed/);
});
