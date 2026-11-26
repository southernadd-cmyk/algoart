// An isolated test tower using the SAME full 3D exhibition source,
// replacing only its portrait sculpture renderer, never production.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {normalizeGalleryEntry} from './gallery-entry-template.mjs';

const target=resolve('gallery/visit/gallery-phi-hybrid-test-bundle.js');
const replacement=resolve('gallery/hybrid-tower-test/sculpture-render-hybrid.mjs');
const n8ao=resolve('node_modules/n8ao/dist/N8AO.js');
const original=readFileSync(n8ao,'utf8');
const pattern=/get texture\(\)\s*\{\s*return this\.textures;\s*\}/g;
assert.equal([...original.matchAll(pattern)].length,1);
const patched=original.replace(pattern,'get texture() { return this.textures[0]; }');
const three=JSON.parse(await readFile('node_modules/three/package.json','utf8'));
assert.equal(three.version,'0.187.0');
let replaced=0,n8aoFixes=0;
await mkdir(dirname(target),{recursive:true});
await build({
 entryPoints:['gallery/visit/gallery-phi.js'],
 bundle:true,minify:true,platform:'browser',format:'esm',target:'es2022',
 outfile:target,
 plugins:[{
  name:'hybrid-museum-pin-test-only',
  setup(b){
   b.onLoad({filter:/[/\\]sculpture-render-traced\.mjs$/},async()=>{
    replaced++;
    return {contents:await readFile(replacement,'utf8'),loader:'js',
      resolveDir:dirname(replacement)};
   });
   b.onLoad({filter:/[/\\]n8ao[/\\]dist[/\\]N8AO\.js$/},args=>{
    assert.equal(resolve(args.path),n8ao);n8aoFixes++;
    return {contents:patched,loader:'js',resolveDir:dirname(n8ao)};
   });
  }
 }],
 logLevel:'warning'
});
assert.equal(replaced,1,'Failed to intercept gallery portrait sculptures');
assert.equal(n8aoFixes,1,'Three r187 N8AO compatibility patch missing');
assert.ok((await readFile(target)).length>200000);
const {html:live}=normalizeGalleryEntry(await readFile('gallery/visit/index.html','utf8'));
let html=live.replace('<head>','<head>\n<base href="../visit/">\n<meta name="robots" content="noindex,nofollow">');
assert.notEqual(html,live);
// Match the production V2 bundle identity, not its changing release cache key.
const preload=[...live.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="(\.\/gallery-phi-sculpture-v2-test-bundle\.js\?v=[A-Za-z0-9._-]+)"[^>]*>/g)];
const imports=[...live.matchAll(/\bawait import\(['"](\.\/gallery-phi-sculpture-v2-test-bundle\.js\?v=[A-Za-z0-9._-]+)['"]\)/g)];
assert.equal(preload.length,1,'Expected one production V2 module preload');
assert.equal(imports.length,1,'Expected one production V2 module import');
assert.equal(preload[0][1],imports[0][1],'Production preload and import must reference the same release');
const old=imports[0][1];
assert.equal(html.split(old).length-1,2,'Expected exactly two production bundle references');
html=html.replaceAll(old,'./gallery-phi-hybrid-test-bundle.js?v=hybrid-pin-test-02');
html=html.replaceAll('Virtual Exhibition | PROPORTION PIECE',
 'Hybrid Sculpture Test Tower | PROPORTION PIECE');
html=html.replace('</body>','<div role="note" style="position:fixed;z-index:31;right:12px;bottom:12px;pointer-events:none;background:#20302cec;color:#f8f0d8;border:1px solid #b69b62;padding:6px 9px;font:600 11px Arial,Helvetica,sans-serif">TEST TOWER · HYBRID / MUSEUM PIN</div></body>');
await writeFile('gallery/hybrid-tower-test/index.html',html);
console.log('TEST_TOWER_HYBRID '+JSON.stringify({
 route:'gallery/hybrid-tower-test/',
 replaced,n8aoFixes,
 productionBundleUntouched:true,originalContourPacksUntouched:true,
 bake:'archive portrait images converted to hybrid geometry on floor visit'
}));
