/**
 * Production Three.js r187 gallery bundle.
 * Pin three@0.187.0, preserve N8AO 2.0.1's two-texture half-resolution
 * attachment, and repair its obsolete singular texture getter.
 * This reproduces the browser-verified test without mutating node_modules.
 */
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const three=JSON.parse(readFileSync('node_modules/three/package.json','utf8'));
const n8ao=JSON.parse(readFileSync('node_modules/n8ao/package.json','utf8'));
assert.equal(three.version,'0.187.0','Refusing to build production with any other Three.js version');
assert.equal(n8ao.version,'2.0.1','N8AO changed: audit its MRT fix before building production');

const n8aoFile=resolve('node_modules/n8ao/dist/N8AO.js');
const original=readFileSync(n8aoFile,'utf8');
const pattern=/get texture\(\)\s*\{\s*return this\.textures;\s*\}/g;
assert.equal([...original.matchAll(pattern)].length,1,'N8AO MRT getter has changed; stop rather than patch unknown code');
const patched=original.replace(pattern,'get texture() { return this.textures[0]; }');
let applications=0;

await build({
 entryPoints:['gallery/visit/gallery-phi.js'],
 bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',
 outfile:'gallery/visit/gallery-phi-bundle.js',
 plugins:[{
  name:'n8ao-r187-mrt-compatibility',
  setup(b){
   b.onLoad({filter:/[\\/]n8ao[\\/]dist[\\/]N8AO\.js$/},args=>{
    assert.equal(resolve(args.path),n8aoFile,'Unexpected N8AO package resolved');
    applications++;
    return {contents:patched,loader:'js',resolveDir:resolve('node_modules/n8ao/dist')};
   });
  }
 }],
 logLevel:'info'
});
assert.equal(applications,1,'N8AO fix was not applied exactly once');
assert.ok(readFileSync('gallery/visit/gallery-phi-bundle.js').length>200000,'Production bundle is unexpectedly small');
console.log('PRODUCTION_R187_N8AO_FIX '+JSON.stringify({
 three:three.version,n8ao:n8ao.version,patchedGetter:'this.textures[0]',
 bundle:'gallery/visit/gallery-phi-bundle.js',applications
}));
