// Deterministic permanent reception sculpture checks; historical V2 stays untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const output=resolve(process.env.V2_RECEPTION_OUT||'artifacts/sculpture-v2-reception');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('independent reception sculpture is prepared and links to its actual source',async()=>{
  const meta=JSON.parse(await readFile(join(output,'manifest.json'),'utf8'));
  const original=await readFile('gallery/visit/data/reception-growth-systems.png');
  const source=JSON.parse(await readFile('gallery/visit/data/reception-growth-systems.json'));
  assert.equal(meta.schema,'pp-v2-reception-source');
  assert.equal(meta.version,2);
  assert.equal(meta.sourceSha256,sha(original));
  assert.equal(meta.seed,source.seed);
  assert.equal(meta.href,source.href);
  assert.match(meta.href,/mode=rects/);
  assert.deepEqual(Object.keys(meta.quality).sort(),['desktop','mobile']);
  for(const quality of ['desktop','mobile']){
    const spec=meta.quality[quality];
    const bytes=await readFile(join(output,spec.file));
    assert.equal(sha(bytes),spec.sha256);
    assert.equal(bytes.length,spec.byteLength);
    const pack=JSON.parse(gunzipSync(bytes));
    assert.equal(pack.date,'reception');
    assert.equal(pack.quality,quality);
    assert.equal(pack.expectedPortraits,1);
    assert.equal(pack.complete,true);
    const item=pack.studies['reception-growth-systems.png'];
    assert.equal(item.seed,source.seed);
    assert.equal(item.coverage,1);
    assert.equal(item.omittedCells,0);
    assert.equal(item.sourceSha256,sha(original));
    assert.equal(item.geometryRevision,'v4.2.1-v2-pigment-island-fix');
    assert.equal(item.regionCount,spec.regions);
    assert.equal(item.triangleCount,spec.triangles);
    assert.ok(item.meshes.length>=item.regionCount);
  }
});
