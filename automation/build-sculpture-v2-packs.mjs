// Prepared Sculpture V2 mesh packs (dry-run and future offline builder).
// This NEVER writes the V1 sculptures.json.gz files or updates main.
// Output is outside gallery/ by default; it can be promoted only after review.
import {readFile,readdir,mkdir,writeFile,rename,access} from 'node:fs/promises';
import {join,resolve,basename,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const args=process.argv.slice(2);
function flag(name,defaultValue=null){
  const i=args.indexOf(name);
  return i<0?defaultValue:args[i+1];
}
const all=args.includes('--all');
const date=flag('--date');
if(all===Boolean(date))
  throw Error('Choose exactly one: --date YYYY-MM-DD or --all');
if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid YYYY-MM-DD');
const qualityOption=flag('--quality','both');
if(!['both','desktop','mobile'].includes(qualityOption))
  throw Error('Quality must be both, mobile or desktop');
const qualities=qualityOption==='both'?['desktop','mobile']:[qualityOption];
const target=resolve(flag('--out','artifacts/sculpture-v2-packs'));
const maxStudies=Number(flag('--limit','0'));
if(!Number.isInteger(maxStudies)||maxStudies<0)throw Error('Invalid --limit');
const base=process.env.V2_BAKE_URL||'http://127.0.0.1:4173/';
const commit=process.env.GITHUB_SHA||process.env.V2_BAKER_COMMIT||'local';
const hash=b=>createHash('sha256').update(b).digest('hex');
const exists=async p=>{try{await access(p);return true}catch{return false}};
const selected=all?
  (await readdir('gallery',{withFileTypes:true}))
    .filter(x=>x.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(x.name))
    .map(x=>x.name).sort():[date];
if(!selected.length)throw Error('No archived dates found');
const browser=await chromium.launch({
  headless:true,args:['--disable-dev-shm-usage','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
let total=0,failed=0;
const report=[];
try{
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  page.on('pageerror',err=>console.error('V2 bake browser error:',err.message));
  await page.goto(new URL('gallery/sculpture-v2-test/sculpture-bake.html',base).href,
    {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.bakeV2Ready===true,null,{timeout:60000});
  // Regression gate: the first full-archive bake failed on this mobile
  // oil study. Exercise BOTH source sizes before investing in 37 floors.
  if(all){
    const fixtureDay='2026-10-18';
    const fixtureFile='2026-10-18-oil-portrait-01-geometric-OP-20261018-01-11851.jpg';
    const fixtureMeta=JSON.parse(await readFile(
      join('gallery',fixtureDay,'meta.json'),'utf8'));
    const fixture=fixtureMeta.entries.find(x=>x.imageFile===fixtureFile);
    assert.ok(fixture,'Historical V2 regression portrait not in archive');
    for(const fixtureQuality of qualities){
      const stem=fixtureFile.replace(/\.[^.]+$/,'');
      const candidate=join('3d',stem+'-'+
        (fixtureQuality==='mobile'?'640':'1100')+'.webp');
      const sourceFile=await exists(join('gallery',fixtureDay,candidate))?
        candidate:fixtureFile;
      const geometry=await page.evaluate(
        async ({item,date,quality})=>window.bakeV2Study({item,date,quality}),
        {item:{...fixture,sourceFile},date:fixtureDay,quality:fixtureQuality}
      );
      assert.equal(geometry.coverage,1,'Regression source coverage');
      assert.equal(geometry.omittedCells,0,'Regression lost pigment');
      assert.ok(geometry.triangleCount>0,'Regression has no geometry');
      assert.ok(geometry.meshes.length>=geometry.regionCount,
        'Regression omitted a source pigment region');
      console.log('V2_REGRESSION_OK '+JSON.stringify({
        date:fixtureDay,file:fixtureFile,quality:fixtureQuality,
        regions:geometry.regionCount,triangles:geometry.triangleCount
      }));
    }
  }
  if(all){
    const day='2026-10-10',
      filename='2026-10-10-portrait-01-rects-AP-20261010-01-70606.jpg';
    const meta=JSON.parse(await readFile(
      join('gallery',day,'meta.json'),'utf8'));
    const item=meta.entries.find(x=>x.imageFile===filename);
    assert.ok(item,'Second historical V2 regression portrait unavailable');
    for(const quality of qualities){
      const stem=filename.replace(/\\.[^.]+$/,'');
      const candidate=join('3d',stem+'-'+
        (quality==='mobile'?'640':'1100')+'.webp');
      const sourceFile=await exists(join('gallery',day,candidate))?
        candidate:filename;
      const geometry=await page.evaluate(
        async ({item,date,quality})=>window.bakeV2Study({item,date,quality}),
        {item:{...item,sourceFile},date:day,quality}
      );
      assert.equal(geometry.coverage,1);
      assert.equal(geometry.omittedCells,0);
      assert.ok(geometry.meshes.length>=geometry.regionCount);
      console.log('V2_REGRESSION_OK '+JSON.stringify({
        date:day,file:filename,quality,regions:geometry.regionCount,
        triangles:geometry.triangleCount,
        pixelFallbackRegions:geometry.pixelFallbackRegions
      }));
    }
  }
  for(const day of selected){
    const meta=JSON.parse(await readFile(join('gallery',day,'meta.json'),'utf8'));
    assert.equal(meta.date,day,'Archive date mismatch');
    const portraits=meta.entries.filter(x=>x.orientation==='portrait'&&
      x.material!=='confluence');
    if(!portraits.length){report.push({date:day,eligible:0});continue;}
    const chosen=maxStudies?portraits.slice(0,maxStudies):portraits;
    const folder=join(target,day,'3d','v2');
    await mkdir(folder,{recursive:true});
    const reportDay={date:day,eligible:portraits.length,baked:0,quality:{},errors:[]};
    for(const quality of qualities){
      const studies={};
      let triangleCount=0,grouped=0,pixelFallbackRegions=0;
      const originals={};
      const records=[];
      const begin=Date.now();
      for(const item of chosen){
        let sourceFile=item.imageFile;
        const stem=item.imageFile.replace(/\.[^.]+$/,'');
        const candidate=join('3d',stem+'-'+(quality==='mobile'?'640':'1100')+'.webp');
        if(await exists(join('gallery',day,candidate)))sourceFile=candidate;
        try{
          const sourceBuffer=await readFile(join('gallery',day,sourceFile));
          const payload=await page.evaluate(
            async ({item,date,quality})=>window.bakeV2Study({item,date,quality}),
            {item:{...item,sourceFile},date:day,quality}
          );
          assert.equal(payload.schema,'pp-sculpture-v2-study');
          assert.equal(payload.imageFile,item.imageFile);
          assert.equal(payload.sourceFile,sourceFile);
          assert.equal(payload.quality,quality);
          assert.equal(payload.method,'assembly');
          assert.equal(payload.coverage,1);
          assert.equal(payload.omittedCells,0);
          assert.ok(payload.regionCount>=1);
          assert.ok(payload.meshes.length>=payload.regionCount);
          payload.sourceSha256=hash(sourceBuffer);
          studies[item.imageFile]=payload;
          triangleCount+=payload.triangleCount;
          grouped+=payload.groupedSmallIslands;
          pixelFallbackRegions+=payload.pixelFallbackRegions||0;
          records.push({
            file:item.imageFile,sourceFile,sourceSha256:payload.sourceSha256,
            regions:payload.regionCount,triangles:payload.triangleCount,
            groupedSmallIslands:payload.groupedSmallIslands,
            pixelFallbackRegions:payload.pixelFallbackRegions||0
          });
        }catch(error){
          failed++;
          reportDay.errors.push({
            file:item.imageFile,quality,error:String(error?.message||error)
          });
          // Fail closed. An incomplete pack must never be promoted.
          throw Error(day+'/'+item.imageFile+'/'+quality+': '+error.message);
        }
      }
      const pack={
        schema:'pp-sculpture-v2-floor',
        version:2,geometryRevision:'v4.2.1-v2-pigment-island-fix',
        builderCommit:commit,
        date:day,quality,method:'assembly',
        expectedPortraits:portraits.length,bakedPortraits:chosen.length,
        complete:chosen.length===portraits.length,
        studies
      };
      assert.equal(Object.keys(studies).length,chosen.length);
      const raw=Buffer.from(JSON.stringify(pack));
      const zip=gzipSync(raw,{level:9});
      const file='sculptures.'+quality+'.json.gz';
      // Validate compressed bytes before atomically publishing the local file.
      assert.deepEqual(JSON.parse(gunzipSync(zip)).studies&&
        Object.keys(JSON.parse(gunzipSync(zip)).studies).sort(),
        Object.keys(studies).sort());
      const temp=join(folder,'.'+file+'.tmp');
      await writeFile(temp,zip);
      await rename(temp,join(folder,file));
      const entry={
        date:day,quality,file,
        sha256:hash(zip),uncompressedBytes:raw.length,
        compressedBytes:zip.length,sourceCount:chosen.length,
        expectedSourceCount:portraits.length,
        complete:chosen.length===portraits.length,
        triangleCount,groupedSmallIslands:grouped,
        pixelFallbackRegions,
        elapsedMs:Date.now()-begin,records
      };
      reportDay.quality[quality]=entry;
      reportDay.baked=Math.max(reportDay.baked,chosen.length);
      total+=chosen.length;
      console.log('V2_BAKE_QUALITY '+JSON.stringify({
        date:day,quality,baked:chosen.length,total:portraits.length,
        triangles:triangleCount,pixelFallbackRegions,
        bytes:zip.length,elapsedMs:entry.elapsedMs,
        complete:entry.complete
      }));
    }
    report.push(reportDay);
    await writeFile(join(folder,'manifest.json'),JSON.stringify({
      schema:'pp-sculpture-v2-floor-manifest',
      version:2,revision:'v4.2.1-v2-pigment-island-fix',
      builderCommit:commit,date:day,methods:['assembly'],
      expectedPortraits:portraits.length,
      samplesOnly:chosen.length!==portraits.length,
      qualities:Object.fromEntries(Object.entries(reportDay.quality)
        .map(([q,v])=>[q,{
          file:v.file,sha256:v.sha256,
          byteLength:v.compressedBytes,bakedPortraits:v.sourceCount,
          complete:v.complete
        }]))
    },null,2));
  }
}finally{
  await browser.close();
}
await mkdir(target,{recursive:true});
const result={
  schema:'pp-sculpture-v2-bake-report',version:2,
  builderCommit:commit,
  generatedAt:new Date().toISOString(),mode:all?'historical':'single-day',
  sourceDateCount:selected.length,qualityVariants:qualities,
  attempted:total,failed,days:report
};
await writeFile(join(target,'bake-report.json'),JSON.stringify(result,null,2));
console.log('SCULPTURE_V2_BAKE_COMPLETE '+JSON.stringify({
  dates:selected.length,studies:total,failed,output:target,
  fullyCovered:report.every(d=>!d.eligible||d.baked===d.eligible)
}));
