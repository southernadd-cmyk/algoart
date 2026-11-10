// Isolated TEST-TOWER build of the exact current gallery-phi source.
// Replace ONE sculpture factory import at bundle-time, not in production code.
// Reuse the verified production r187 / n8ao 2.0.1 MRT patch unchanged.
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const three=JSON.parse(readFileSync('node_modules/three/package.json','utf8'));
const n8ao=JSON.parse(readFileSync('node_modules/n8ao/package.json','utf8'));
assert.equal(three.version,'0.187.0');
assert.equal(n8ao.version,'2.0.1');
const source=resolve('gallery/visit/gallery-phi.js');
const original=readFileSync(source,'utf8');
const importPattern=/import\s*\{\s*createPortraitSculpture\s*,\s*setSculptureArchitecturalMaterials\s*\}\s*from\s*'\.\/sculpture-render-traced\.mjs\?v=[^']+';/g;
assert.equal([...original.matchAll(importPattern)].length,1,
 'Tower sculpture factory import changed: do not patch an unknown source');
const patchedSource=original.replace(importPattern,
 "import {createPortraitSculpture,setSculptureArchitecturalMaterials} from './sculpture-test-tower-adapter.mjs';");
const n8aoFile=resolve('node_modules/n8ao/dist/N8AO.js');
const aoSource=readFileSync(n8aoFile,'utf8');
const aoPattern=/get texture\(\)\s*\{\s*return this\.textures;\s*\}/g;
assert.equal([...aoSource.matchAll(aoPattern)].length,1);
const patchedAO=aoSource.replace(aoPattern,
 'get texture() { return this.textures[0]; }');
let patches=0,aoPatches=0;
const output='gallery/visit/gallery-phi-sculpture-test-bundle.js';
await build({
 entryPoints:[source],outfile:output,
 bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',
 plugins:[{
  name:'isolated-hybrid-tower-sculpture-adapter',
  setup(b){
   b.onLoad({filter:/[\\/]gallery[\\/]visit[\\/]gallery-phi\.js$/},args=>{
    assert.equal(resolve(args.path),source);
    patches++;
    return {contents:patchedSource,loader:'js',
      resolveDir:resolve('gallery/visit')};
   });
  }
 },{
  name:'unchanged-r187-n8ao-mrt',
  setup(b){
   b.onLoad({filter:/[\\/]n8ao[\\/]dist[\\/]N8AO\.js$/},args=>{
    assert.equal(resolve(args.path),n8aoFile);
    aoPatches++;
    return {contents:patchedAO,loader:'js',
      resolveDir:resolve('node_modules/n8ao/dist')};
   });
  }
 }],
 logLevel:'info'
});
assert.equal(patches,1);
assert.equal(aoPatches,1);
const bundle=readFileSync(output,'utf8');
assert.ok(bundle.length>200000,'Test tower bundle looks truncated');
assert.ok(bundle.includes('isolated-hybrid-museum-pin-v1'),
 'Test bundle does not contain the hybrid tower adapter');
assert.ok(!bundle.includes('PP-SCULPTURE-v1:'),
 'The test bundle unexpectedly contains the old sculpture material factory');
console.log('ISOLATED_TEST_HYBRID_TOWER_BUNDLE_OK',JSON.stringify({
 output,bytes:bundle.length,
 three:three.version,n8ao:n8ao.version,
 sculptureAdapterPatches:patches,n8aoPatches:aoPatches
}));
