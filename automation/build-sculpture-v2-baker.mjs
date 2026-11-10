// Local browser baker bundle. Test-only output; never touches live tower.
import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const pkg=JSON.parse(await readFile('node_modules/three/package.json','utf8'));
assert.equal(pkg.version,'0.187.0');
const entry='gallery/sculpture-v2-test/v2-baker.mjs';
const output='gallery/sculpture-v2-test/v2-baker-bundle.js';
await build({
  entryPoints:[entry],outfile:output,bundle:true,minify:true,
  platform:'browser',format:'esm',target:'es2022',logLevel:'warning'
});
assert.ok((await readFile(output)).length>60000);
await writeFile('gallery/sculpture-v2-test/sculpture-bake.html',String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<title>V2 offline sculpture asset baker (development only)</title>
</head><body><script type="module" src="./v2-baker-bundle.js"></script></body></html>`);
console.log('V2_OFFLINE_BAKER_READY '+JSON.stringify({entry,output,productionUnchanged:true}));
