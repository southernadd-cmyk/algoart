// Copies only audited sculpture V2 assets into an isolated static gallery tree.
// Source is the pinned, read-only GitHub Actions artifact; V1 is never touched.
import {readFile,access,mkdir,copyFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const [srcArg,destArg]=process.argv.slice(2);
assert.ok(srcArg&&destArg,'Usage: node stage-sculpture-v2-preview.mjs <artifact-root> <gallery-root>');
const src=resolve(srcArg),dest=resolve(destArg);
const report=JSON.parse(await readFile(join(src,'bake-report.json'),'utf8'));
assert.equal(report.schema,'pp-sculpture-v2-bake-report');
assert.equal(report.mode,'historical');
assert.equal(report.failed,0);
assert.equal(report.sourceDateCount,37);
assert.equal(report.attempted,534);
assert.deepEqual(report.qualityVariants,['desktop','mobile']);
assert.equal(report.days.length,37);
let files=0,portraitCount=0,bytes=0;
for(const floor of report.days){
  assert.match(floor.date,/^20\d{2}-\d{2}-\d{2}$/);
  portraitCount+=floor.eligible;
  if(!floor.eligible)continue;
  assert.equal(floor.baked,floor.eligible);
  const folder=join(src,floor.date,'3d','v2');
  const manifest=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
  assert.equal(manifest.expectedPortraits,floor.eligible);
  assert.deepEqual(Object.keys(manifest.qualities).sort(),['desktop','mobile']);
  const out=join(dest,floor.date,'3d','v2');
  await mkdir(out,{recursive:true});
  for(const quality of ['desktop','mobile']){
    const item=manifest.qualities[quality];
    assert.equal(item.complete,true);
    assert.equal(item.bakedPortraits,floor.eligible);
    const filename='sculptures.'+quality+'.json.gz';
    assert.equal(item.file,filename);
    const file=join(folder,filename);
    const size=(await stat(file)).size;
    assert.equal(size,item.byteLength);
    await copyFile(file,join(out,filename));
    bytes+=size;files++;
  }
  await copyFile(join(folder,'manifest.json'),join(out,'manifest.json'));
}
assert.equal(portraitCount,267);
assert.equal(files,66);
console.log('V2_PREPARED_STAGE_OK '+JSON.stringify({
  archiveDates:report.days.length,eligiblePortraits:portraitCount,
  qualityPacks:files,bytes,destination:dest,
  deployedOutsideV1:true
}));
