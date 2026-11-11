import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

test('R2-only cleanup needs public verification and deletes only artwork within the selected edition',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pp-r2-prune-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const checkout=path.join(dir,'checkout'),stage=path.join(dir,'stage');
  const date='2026-11-09', edition='gallery/'+date;
  await fs.mkdir(path.join(checkout,'gallery'),{recursive:true});
  await fs.cp(edition,path.join(checkout,edition),{recursive:true});
  for(const file of ['index.html','archive.json','feed.xml'])
    await fs.copyFile('gallery/'+file,path.join(checkout,'gallery',file));
  const env={...process.env,R2_ART_ONLY:'true',R2_EDITION_DATE:date,
    R2_STAGE_OUTPUT:stage,R2_STAGE_SOURCE:checkout};
  const run=(script)=>spawnSync(process.execPath,[path.resolve(script)],{cwd:checkout,env,encoding:'utf8'});
  let result=run('automation/prepare-r2-daily.mjs');
  assert.equal(result.status,0,result.stderr||result.stdout);
  result=run('automation/prune-r2-art-only.mjs');
  assert.notEqual(result.status,0,'Cleanup must reject unverified R2 upload');
  const raw=await fs.readFile(path.join(stage,'media-publication.json'));
  const manifest=JSON.parse(raw);
  await fs.writeFile(path.join(stage,'upload-verification.json'),JSON.stringify({
    date,manifestSha256:createHash('sha256').update(raw).digest('hex'),
    verified:manifest.mediaAssets.length
  }));
  result=run('automation/prune-r2-art-only.mjs');
  assert.notEqual(result.status,0,'Cleanup must reject pages with local image references');
  result=run('automation/activate-r2-daily.mjs');
  assert.equal(result.status,0,result.stderr||result.stdout);
  result=run('automation/prune-r2-art-only.mjs');
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.match(result.stdout,/R2_ART_ONLY_PRUNE_OK/);
  for(const asset of manifest.mediaAssets)
    await assert.rejects(fs.stat(path.join(checkout,asset.sourcePath)),{code:'ENOENT'});
  const meta=JSON.parse(await fs.readFile(path.join(checkout,edition,'meta.json'),'utf8'));
  assert.equal(meta.entries.length,16);
  assert.equal(meta.entries.filter(x=>x.media?.original).length,16);
  assert.equal('mediaSculptures' in meta,false);
  assert.ok((await fs.readFile(path.join(checkout,edition,'index.html'),'utf8')).includes(
    'proportion-piece-media.mr-adam-clement.workers.dev'));
  assert.ok((await fs.stat(path.join(checkout,edition,'3d','sculptures.json.gz'))).size>0,
    'Pre-existing historical V1 archives are not removed as part of painting cleanup');
});
