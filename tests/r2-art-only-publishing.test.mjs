import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('R2-only edition stage contains only painting media and cover, no V1 dependency or Pages JPEG fallback',async t=>{
  const stage=await fs.mkdtemp(path.join(os.tmpdir(),'pp-art-only-'));
  t.after(()=>fs.rm(stage,{recursive:true,force:true}));
  const date='2026-11-09';
  const env={...process.env,R2_EDITION_DATE:date,R2_STAGE_OUTPUT:stage,R2_ART_ONLY:'true'};
  const node=spawnSync(process.execPath,['automation/prepare-r2-daily.mjs'],{env,encoding:'utf8'});
  assert.equal(node.status,0,node.stderr||node.stdout);
  const manifest=JSON.parse(await fs.readFile(path.join(stage,'media-publication.json'),'utf8'));
  const stagedMeta=JSON.parse(await fs.readFile(path.join(stage,'gallery',date,'meta.json'),'utf8'));
  const page=await fs.readFile(path.join(stage,'gallery',date,'index.html'),'utf8');
  assert.equal(manifest.count,16);
  assert.equal(manifest.pagesFallback,false);
  assert.equal(manifest.mediaAssets.length,49);
  assert.equal(manifest.mediaAssets.filter(a=>a.role==='original').length,16);
  assert.equal(manifest.mediaAssets.filter(a=>a.role==='desktop').length,16);
  assert.equal(manifest.mediaAssets.filter(a=>a.role==='mobile').length,16);
  assert.equal(manifest.mediaAssets.filter(a=>a.role==='cover').length,1);
  assert.equal(manifest.mediaAssets.some(a=>a.role==='sculptures'),false);
  assert.equal('mediaSculptures' in stagedMeta,false);
  assert.equal((page.match(/data-image-file=/g)||[]).length,16);
  assert.doesNotMatch(page,/onerror="this.onerror=null;this.src=/);
  for(const asset of manifest.mediaAssets)
    assert.ok(asset.url.startsWith(manifest.workerBase+'/editions/'+date+'/'));
  const python=spawnSync('python3',['-c',String.raw`
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('r2_daily', 'automation/r2-daily-media.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
manifest,_=module.inspect_manifest(Path(__import__('sys').argv[1]),False,Path('.'))
assert manifest['pagesFallback'] is False
print('R2_ART_ONLY_INVENTORY_OK')
`,path.join(stage,'media-publication.json')],{encoding:'utf8'});
  assert.equal(python.status,0,python.stderr||python.stdout);
});
