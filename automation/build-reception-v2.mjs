// Dedicated reception sculpture V2 bake, separate from the historical archive.
// Reads a newly generated original 1000x1400 portrait source, not the old landscape.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const output=resolve(process.env.V2_RECEPTION_OUT||'artifacts/sculpture-v2-reception');
const source='gallery/sculpture-v2-test/reception/recursive-divisions-portrait.png';
const metadata=JSON.parse(await readFile(
  'gallery/sculpture-v2-test/reception/source.json','utf8'));
const sourceBytes=await readFile(source);
const sha=data=>createHash('sha256').update(data).digest('hex');
assert.equal(metadata.schema,'pp-v2-reception-portrait-source');
assert.equal(metadata.seed,'PP-RECEPTION-RECTS-P-20261110');
assert.equal(metadata.orientation,'portrait');
assert.equal(metadata.engine,'rects');
assert.equal(metadata.width,1000);
assert.equal(metadata.height,1400);
assert.ok(metadata.href.includes('mode=rects')&&
  metadata.href.includes('fmt=portrait')&&
  metadata.href.includes('seed='+metadata.seed));
assert.equal(sourceBytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert.equal(sourceBytes.readUInt32BE(16),1000);
assert.equal(sourceBytes.readUInt32BE(20),1400);
assert.equal(metadata.sourceSha256,sha(sourceBytes));
await mkdir(output,{recursive:true});
const qualityReports={};
const browser=await chromium.launch({
  headless:true,args:['--disable-dev-shm-usage','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
try{
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  page.on('pageerror',error=>console.error('Reception V2 baker:',error.message));
  await page.goto('http://127.0.0.1:4173/gallery/sculpture-v2-test/sculpture-bake.html',
    {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.bakeV2Ready===true,null,{timeout:60000});
  for(const quality of ['desktop','mobile']){
    const imageFile='recursive-divisions-portrait.png';
    const item={
      imageFile,sourceFile:imageFile,orientation:'portrait',
      seed:metadata.seed,shareUrl:metadata.href,material:'oil',receptionOnly:true
    };
    const study=await page.evaluate(
      async params=>window.bakeV2Study(params),
      {item,date:'reception',quality}
    );
    assert.equal(study.imageFile,imageFile);
    assert.equal(study.quality,quality);
    assert.equal(study.coverage,1);
    assert.equal(study.omittedCells,0);
    assert.ok(study.regionCount>=1&&study.meshes.length>=study.regionCount);
    assert.ok(study.triangleCount>0);
    study.sourceSha256=sha(sourceBytes);
    const pack={
      schema:'pp-sculpture-v2-floor',version:2,
      geometryRevision:'v4.2.1-v2-pigment-island-fix',
      date:'reception',quality,method:'assembly',expectedPortraits:1,
      bakedPortraits:1,complete:true,
      studies:{[imageFile]:study}
    };
    const file='sculptures.'+quality+'.json.gz';
    const bytes=gzipSync(Buffer.from(JSON.stringify(pack)),{level:9});
    assert.equal(JSON.parse(gunzipSync(bytes)).studies[imageFile].sourceSha256,
      sha(sourceBytes));
    await writeFile(join(output,file),bytes);
    qualityReports[quality]={
      file,sha256:sha(bytes),byteLength:bytes.length,
      triangles:study.triangleCount,regions:study.regionCount,
      pixelFallbackRegions:study.pixelFallbackRegions||0,
      complete:true
    };
    console.log('V2_RECEPTION_BAKED '+JSON.stringify({
      quality,triangles:study.triangleCount,regions:study.regionCount,
      bytes:bytes.length,coverage:study.coverage,omitted:study.omittedCells
    }));
  }
}finally{await browser.close();}
const report={
  schema:'pp-v2-reception-source',version:2,
  source,sourceSha256:sha(sourceBytes),seed:metadata.seed,
  sourceWidth:1000,sourceHeight:1400,orientation:'portrait',
  href:metadata.href,quality:qualityReports,archiveUnchanged:true
};
await writeFile(join(output,'manifest.json'),JSON.stringify(report,null,2));
console.log('V2_RECEPTION_COMPLETE '+JSON.stringify({
  qualities:Object.keys(qualityReports),source:metadata.seed,mode:'isolated'
}));
