// Offline Sculpture V2 pack integrity, independent of the Three.js live tower.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {reconstructV2Study,disposePreparedV2}
  from '../gallery/sculpture-v2-test/v2-pack-loader.mjs';

const root=resolve(process.env.V2_BAKE_OUT||'artifacts/sculpture-v2-packs');
const hash=data=>createHash('sha256').update(data).digest('hex');
async function exists(path){try{await access(path);return true}catch{return false}}
test('sample packs are independently reconstructable and source-checked',async()=>{
  const report=JSON.parse(await readFile(join(root,'bake-report.json')));
  assert.equal(report.schema,'pp-sculpture-v2-bake-report');
  assert.equal(report.failed,0);
  assert.ok(report.attempted>0,'No sculpture models were baked');
  assert.ok(report.days.length>=1);
  assert.equal(report.days.length,report.sourceDateCount,
    'A reported archive date is missing');
  if(report.mode==='historical'){
    const archived=(await readdir('gallery',{withFileTypes:true}))
      .filter(x=>x.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(x.name))
      .map(x=>x.name).sort();
    assert.deepEqual(report.days.map(x=>x.date).sort(),archived,
      'The historical archive was not exhaustively visited');
    assert.deepEqual(report.qualityVariants,['desktop','mobile'],
      'Historical V2 requires both mesh qualities');
  }
  let total=0,expectedEligible=0;
  for(const day of report.days){
    const source=JSON.parse(await readFile(
      join('gallery',day.date,'meta.json'),'utf8'));
    const eligible=source.entries.filter(x=>
      x.orientation==='portrait'&&x.material!=='confluence').length;
    assert.equal(day.eligible,eligible,
      'Historical eligible portrait inventory differs at '+day.date);
    expectedEligible+=eligible;
    if(report.mode==='historical'&&eligible)
      assert.equal(day.baked,eligible,
        'Incomplete portrait floor at '+day.date);
    const manifestPath=join(root,day.date,'3d','v2','manifest.json');
    if(!await exists(manifestPath)){
      assert.equal(eligible,0,'Eligible floor is missing its V2 manifest: '+day.date);
      continue;
    }
    const manifest=JSON.parse(await readFile(manifestPath));
    assert.equal(manifest.expectedPortraits,eligible);
    if(report.mode==='historical'){
      assert.deepEqual(Object.keys(manifest.qualities).sort(),
        ['desktop','mobile'],'Missing historical quality for '+day.date);
      for(const entry of Object.values(manifest.qualities))
        assert.equal(entry.complete,true,'Incomplete historical mesh pack');
    }
    assert.equal(manifest.version,2);
    assert.equal(manifest.date,day.date);
    for(const [quality,entry] of Object.entries(manifest.qualities)){
      const file=join(root,day.date,'3d','v2',entry.file);
      const binary=await readFile(file);
      assert.equal(hash(binary),entry.sha256,'Pack checksum mismatch');
      assert.equal(binary.length,entry.byteLength);
      assert.ok(binary.length<45*1024*1024,'Floor pack too large; investigate');
      const pack=JSON.parse(gunzipSync(binary).toString('utf8'));
      assert.equal(pack.schema,'pp-sculpture-v2-floor');
      assert.equal(pack.date,day.date);
      assert.equal(pack.quality,quality);
      assert.equal(pack.method,'assembly');
      assert.equal(pack.complete,entry.complete);
      assert.equal(Object.keys(pack.studies).length,entry.bakedPortraits);
      if(pack.complete)assert.equal(entry.bakedPortraits,manifest.expectedPortraits);
      else assert.equal(manifest.samplesOnly,true,'Incomplete pack must be flagged');
      let imageRegions=0;
      for(const [fileName,data] of Object.entries(pack.studies)){
        assert.equal(data.imageFile,fileName);
        const original=await readFile(join('gallery',day.date,data.sourceFile));
        assert.equal(hash(original),data.sourceSha256,
          'Original painting content differs from baked source');
        assert.equal(data.quality,quality);
        assert.equal(data.omittedCells,0,'Prepared sculpture silently omitted paint');
        assert.equal(data.coverage,1,'Prepared sculpture source incomplete');
        assert.ok(data.regionCount>0);
        const paintingTexture=new THREE.Texture();
        const result=reconstructV2Study(data,paintingTexture);
        try{
          assert.equal(result.body.userData.regionCount,data.regionCount);
          assert.equal(result.body.userData.polygonTriangles,data.triangleCount);
          assert.equal(result.body.children.length,data.meshes.length);
          for(const mesh of result.body.children){
            assert.ok(mesh.isMesh);
            assert.equal(mesh.geometry.index.count%3,0);
            const p=mesh.geometry.getAttribute('position');
            assert.equal(p.count,mesh.geometry.getAttribute('normal').count);
            assert.equal(p.count,mesh.geometry.getAttribute('uv').count);
          }
          const box=new THREE.Box3().setFromObject(result.body);
          const size=box.getSize(new THREE.Vector3()).toArray();
          for(let i=0;i<3;i++)assert.ok(
            Math.abs(size[i]-data.dimensions[i])<.00012,
            'Quantized V2 geometry bounds changed at '+fileName);
          imageRegions+=data.regionCount;
        }finally{
          disposePreparedV2(result);
          paintingTexture.dispose();
        }
        total++;
      }
      console.log('V2_PACK_VERIFIED '+JSON.stringify({
        date:day.date,quality,studies:entry.bakedPortraits,
        regions:imageRegions,compressedKiB:Math.round(binary.length/1024),
        complete:entry.complete
      }));
    }
  }
  assert.ok(total>0,'No V2 meshes reconstructed from offline packs');
  assert.equal(total,report.attempted,'Reported output does not match audited models');
  if(report.mode==='historical')
    assert.equal(total,expectedEligible*2,
      'The full archive needs one desktop and one mobile sculpture per portrait');
  console.log('V2_ARCHIVE_AUDIT_OK '+JSON.stringify({
    dates:report.days.length,eligiblePortraits:expectedEligible,
    auditedModels:total,mode:report.mode
  }));
});
test('candidate pack process never alters existing V1 sculpture files',async()=>{
  const report=JSON.parse(await readFile(join(root,'bake-report.json')));
  for(const day of report.days){
    if(!day.eligible)continue;
    const v1=join('gallery',day.date,'3d','sculptures.json.gz');
    assert.ok(await exists(v1),'Historical V1 pack missing: '+day.date);
    const manifest=join(root,day.date,'3d','v2','manifest.json');
    assert.ok(await exists(manifest),'V2 manifest missing: '+day.date);
  }
  const build=await readFile('automation/build-sculpture-v2-packs.mjs','utf8');
  assert.doesNotMatch(build,/writeFile\([^)]*sculptures\.json\.gz/);
  const v1=await readFile('gallery/visit/sculpture-render-traced.mjs','utf8');
  assert.doesNotMatch(v1,/v2-pack-loader/);
});
