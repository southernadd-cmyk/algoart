// Live, read-only browser acceptance: distinguish real V2 R2 sculptures
// from V1 objects or empty placeholder plinths on Cloudflare staging.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base='https://proportion-piece-web-canary.mr-adam-clement.workers.dev/algoart/';
const tower=base+'gallery/sculpture-v2-test/';
const v2Gateway='https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev/';
const browser=await chromium.launch({headless:true,args:[
  '--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
try{
  for(const spec of [
    {date:'reception',width:1100,height:740,quality:'desktop'},
    {date:'2026-11-10',width:1100,height:740,quality:'desktop'},
    {date:'2026-10-22',width:390,height:844,quality:'mobile'}
  ]){
    const page=await browser.newPage({
      viewport:{width:spec.width,height:spec.height},
      deviceScaleFactor:.6,isMobile:spec.quality==='mobile',
      hasTouch:spec.quality==='mobile'
    });
    const jsErrors=[],networkErrors=[],v2Requests=[],v2Responses=[],scripts=[];
    page.on('pageerror',e=>jsErrors.push(e.message));
    page.on('requestfailed',r=>networkErrors.push({
      url:r.url(),failure:r.failure()?.errorText
    }));
    page.on('request',r=>{
      const u=r.url();
      if(u.startsWith(v2Gateway))v2Requests.push(u);
      if(u.includes('/gallery/visit/gallery-phi')&&u.includes('bundle'))scripts.push(u);
    });
    page.on('response',r=>{
      if(r.url().startsWith(v2Gateway))
        v2Responses.push({status:r.status(),url:r.url()});
    });
    try {
      const suffix=spec.date==='reception'?'':'date='+spec.date+'&';
      const url=tower+'?'+suffix+'debug&canary-v2-mount-check=1';
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
      assert.equal(response.status(),200,'V2 test tower HTTP failure');
      await page.waitForFunction(()=>window.__sculptureV2TowerStatus||
        window.__galleryStartupError,null,{timeout:100000});
      assert.ok(!await page.evaluate(()=>window.__galleryStartupError),
        'V2 tower JavaScript startup failure');
      await page.waitForFunction(()=>{
        const s=window.__sculptureV2TowerStatus;
        return s?.complete>0||s?.failed>0;
      },null,{timeout:120000});
      const status=await page.evaluate(()=>window.__sculptureV2TowerStatus);
      const detail={date:spec.date,quality:spec.quality,
        attempted:status.attempted,complete:status.complete,failed:status.failed,
        builds:status.builds,transport:status.transport,
        errors:jsErrors,networkErrors,v2Requests,v2Responses,scripts};
      console.log('V2_LIVE_MOUNT_DIAGNOSTICS '+JSON.stringify(detail));
      assert.equal(status.mode,'test-only-prepared-v2');
      assert.equal(status.modelSource,'sha-verified-r2-only');
      assert.equal(status.productionUnchanged,true);
      assert.ok(scripts.some(u=>u.includes('gallery-phi-sculpture-v2-test-bundle.js')),
        'V2 tower did not load its V2 bundle');
      assert.ok(!scripts.some(u=>/\/gallery-phi-bundle\.js/.test(u)),
        'V2 test tower unexpectedly loaded V1 production bundle');
      assert.equal(status.failed,0,'V2 source sculpture mount failure: '+JSON.stringify(detail));
      assert.ok(status.complete>0,'No V2 sculpture mounted: '+JSON.stringify(detail));
      assert.ok(v2Requests.some(u=>u.includes('sculptures-v2/')),
        'No R2 V2 media downloaded');
      if(spec.date==='reception')
        assert.ok(v2Requests.some(u=>u.includes('/reception/desktop/')),
          'Reception V2 mesh was not requested');
      else assert.ok(v2Requests.some(u=>u.includes(
        '/floors/'+spec.date+'/'+spec.quality+'/')),
        'Historical V2 mesh was not requested');
      assert.ok(status.builds.some(x=>x.state==='complete'&&
        x.transport==='r2'&&x.r2Fallback===false&&
        x.regions>0&&x.triangles>0&&x.anchors>0&&
        x.omittedCells===0&&x.sourceCoverage===1&&x.extent[2]>.01),
        'No completed volumetric V2 mesh with physical pin and full source coverage');
      assert.deepEqual(jsErrors,[],'V2 runtime exception');
      console.log('V2_LIVE_MOUNT_CONFIRMED '+JSON.stringify({
        date:spec.date,quality:spec.quality,
        complete:status.complete,regions:status.builds.filter(x=>x.state==='complete')
          .map(x=>x.regions),noV1Bundle:true
      }));
    }finally {await page.close();}
  }
}finally{await browser.close();}
