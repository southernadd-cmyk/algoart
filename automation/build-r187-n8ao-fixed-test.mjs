/**
 * TEST ONLY: build an r187 gallery bundle with N8AO 2.0.1's MRT compatibility
 * getter corrected. Never writes gallery-phi-bundle.js or the live index.
 *
 * THREE_R187_PACKAGE must resolve to an isolated npm install of three@0.187.0.
 * CI continues to use pinned three@0.180.0 for the real live site.
 */
import {build} from 'esbuild';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const threeRoot=process.env.THREE_R187_PACKAGE;
assert.ok(threeRoot,'THREE_R187_PACKAGE is required; use an isolated three@0.187.0 install.');
const candidateRoot=resolve(threeRoot);
const candidatePackage=JSON.parse(readFileSync(resolve(candidateRoot,'package.json'),'utf8'));
assert.equal(candidatePackage.version,'0.187.0','Refusing to build the wrong Three.js revision');

const n8aoFile=resolve('node_modules/n8ao/dist/N8AO.js');
const original=readFileSync(n8aoFile,'utf8');
const pattern=/get texture\(\)\s*\{\s*return this\.textures;\s*\}/g;
const matches=[...original.matchAll(pattern)];
assert.equal(matches.length,1,'N8AO compatibility getter changed: abort rather than patch the wrong code');
const patched=original.replace(pattern,'get texture() { return this.textures[0]; }');
assert.ok(patched.includes('get texture() { return this.textures[0]; }'));

const out='gallery/visit/gallery-phi-r187-n8ao-fixed-bundle.js';
let applied=0;
const plugin={
 name:'n8ao-r187-mrt-texture-fix',
 setup(build){
  // The Three.js package uses export aliases like "three/addons/".
  // Esbuild's blanket alias to an absolute folder bypasses those exports;
  // map them explicitly to the r187 files instead.
  build.onResolve({filter:/^three(?:\/|$)/},args=>{
   if(args.path==='three')return {path:resolve(candidateRoot,'build/three.module.js')};
   if(args.path.startsWith('three/addons/'))
    return {path:resolve(candidateRoot,'examples/jsm',args.path.slice('three/addons/'.length))};
   if(args.path.startsWith('three/examples/jsm/'))
    return {path:resolve(candidateRoot,'examples/jsm',args.path.slice('three/examples/jsm/'.length))};
   if(args.path.startsWith('three/src/'))
    return {path:resolve(candidateRoot,'src',args.path.slice('three/src/'.length))};
   throw Error('Unexpected Three.js subpath in test build: '+args.path);
  });
  build.onLoad({filter:/[\\/]n8ao[\\/]dist[\\/]N8AO\.js$/},args=>{
   assert.equal(resolve(args.path),n8aoFile,'Unexpected N8AO package path');
   applied++;
   return {contents:patched,loader:'js',resolveDir:resolve('node_modules/n8ao/dist')};
  });
 }
};
await build({
 entryPoints:['gallery/visit/gallery-phi.js'],
 bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',
 outfile:out,
 plugins:[plugin], logLevel:'info'
});
assert.equal(applied,1,'N8AO compatibility patch did not reach the built gallery bundle');
const bundle=readFileSync(out,'utf8');
assert.ok(bundle.length>200000,'Gallery bundle is suspiciously small');

const input='gallery/visit/three-r187-test.html';
let html=readFileSync(input,'utf8');
const originalBundle='gallery-phi-r187-test-bundle.js';
assert.equal(html.split(originalBundle).length-1,2,'Test entrypoint changed; refusing to rewrite unknown references');
assert.ok(html.includes('url.searchParams.set("ao","ssao")'),'Expected default SSAO setting absent');
html=html.replaceAll(originalBundle,'gallery-phi-r187-n8ao-fixed-bundle.js');
html=html.replace('url.searchParams.set("ao","ssao")','url.searchParams.set("ao","n8ao")');
html=html.replace('TEST • Three.js r187 • Virtual Exhibition','TEST • r187 N8AO compatibility fix • Virtual Exhibition');
html=html.replace('TEST BUILD • Three.js r187 • SSAO','TEST BUILD • Three.js r187 • N8AO COMPAT FIX');
html=html.replace('<!-- Isolated r187 test; live page is untouched. -->',
 '<!-- Isolated r187/N8AO fix experiment: does not alter the live tower or SSAO test. -->');
writeFileSync('gallery/visit/three-r187-n8ao-fixed.html',html);

console.log('R187_N8AO_FIXED_BUILT '+JSON.stringify({
 threeVersion:candidatePackage.version,patchedN8ao:'2.0.1',
 originalGetter:'return this.textures',patchedGetter:'return this.textures[0]',
 n8aoModuleInstancesPatched:applied,bundleBytes:bundle.length,
 html:'gallery/visit/three-r187-n8ao-fixed.html',bundle:out
}));
