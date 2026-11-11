// Functional only: no screenshots, visual comparison or automated art judgement.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const R2_RECEPTION_IMAGE="https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev/sculptures-v2/v4.2.1-20261110/reception/image/a66e75e6a8d7ad8616de6a1b501ecfe64b5fb0e5c12970ddb1f3f31b55594c3a.png";
const browser=await chromium.launch({
 headless:true,args:['--disable-dev-shm-usage','--use-gl=angle',
 '--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
try{
  for(const spec of [
    {date:'2026-11-10',quality:'desktop',width:1100,height:740,method:'assembly'},
    {date:'2026-10-22',quality:'mobile',width:390,height:844,method:'assembly'},
    {date:'reception',quality:'desktop',width:1100,height:740,method:'assembly'},
    {date:'reception',quality:'mobile',width:390,height:844,method:'assembly'},
    // Inject a total R2 outage. Fail closed rather than silently using Pages.
    {date:'2026-11-10',quality:'desktop',width:1100,height:740,
      method:'assembly',outage:true}
  ]){
    const page=await browser.newPage({
      viewport:{width:spec.width,height:spec.height},
      deviceScaleFactor:spec.quality==='mobile'?.5:.65,
      hasTouch:spec.quality==='mobile',isMobile:spec.quality==='mobile'
    });
    const errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>requests.push(request.url()));
    // This CI preview is served on localhost. Public R2 correctly permits
    // only https://southernadd-cmyk.github.io. Relay the REAL public bytes
    // and substitute only the response CORS header for local functional tests.
    // The in-browser SHA-256 check still runs on untouched response bodies.
    const workerRoute=
      'https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev/**';
    if(spec.outage)await page.route(workerRoute,route=>route.abort('failed'));
    else await page.route(workerRoute,async route=>{
      const response=await route.fetch({timeout:60000});
      await route.fulfill({response,headers:{
        ...response.headers(),
        'access-control-allow-origin':'http://127.0.0.1:4173'
      }});
    });
    try{
      await page.goto('http://127.0.0.1:4173/gallery/sculpture-v2-test/?'+
        (spec.date==='reception'?'':'date='+spec.date+'&')+
        'v2method='+spec.method+'&debug',
        {waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>
        (window.__sculptureV2TowerStatus && window.__phiFullEngine)||
        window.__galleryStartupError,null,{timeout:100000});
      assert.ok(requests.some(url=>
        url.includes('/gallery/visit/gallery-phi-sculpture-v2-test-bundle.js')),
        'Preview did not import isolated V2 tower bundle');
      assert.ok(!requests.some(url=>
        /\/gallery\/visit\/gallery-phi-bundle\.js/.test(url)),
        'Preview wrongly imported the production tower bundle');
      const startup=await page.evaluate(()=>({
        status:window.__sculptureV2TowerStatus,
        phi:window.__phiFullEngine,
        error:window.__galleryStartupError,
        path:location.pathname
      }));
      assert.ok(!startup.error,
        'Tower startup error: '+startup.error);
      assert.equal(startup.path,'/gallery/sculpture-v2-test/');
      assert.equal(startup.status?.mode,'test-only-prepared-v2');
      assert.equal(startup.status?.variant,'v2.0-prepared-archive');
      assert.equal(startup.status?.method,spec.method);
      assert.equal(startup.status?.connector,'pin');
      assert.ok(startup.phi?.roomCount>0&&
        (startup.phi?.sculptures>0||spec.date==='reception'),
        'Test floor did not load actual archive and sculptures');
      await page.waitForFunction(()=>
        window.__sculptureV2TowerStatus?.complete>0||
        window.__sculptureV2TowerStatus?.failed>0,null,{timeout:120000});
      const state=await page.evaluate(()=>window.__sculptureV2TowerStatus);
      assert.ok(state.attempted>0,'No V2 source sculpture attempted');
      assert.ok(requests.some(url=>url.includes('/sculptures-v2/v4.2.1-20261110/catalog/')),
        'Tower did not request SHA-pinned R2 catalog');
      const localGeometry=url=>
        url.includes('/3d/v2/sculptures.')||
        url.includes('/sculpture-v2-test/reception/sculptures.');
      assert.ok(!requests.some(localGeometry),
        'Isolated tower must never request Pages V2 mesh packs');
      if(spec.outage){
        assert.equal(state.complete,0,'R2 outage must not mount unverified geometry');
        assert.ok(state.failed>0,'R2 outage must appear as a failed V2 load');
        assert.equal(state.transport?.r2,0);
        assert.ok(state.builds.some(item=>item.state==='failed'),
          'V2 error diagnostics missing');
        assert.deepEqual(errors,[],'Outage must not cause uncaught browser exceptions');
        console.log('V2_R2_ONLY_OUTAGE_FAIL_CLOSED '+JSON.stringify({
          date:spec.date,attempted:state.attempted,failed:state.failed,
          noPagesGeometry:true
        }));
        continue;
      }
      assert.equal(state.failed,0,'V2 sculpture failed: '+JSON.stringify(state.builds));
      assert.ok(state.complete>0,'No V2 sculpture completed');
      const r2Path='/sculptures-v2/v4.2.1-20261110/'+
        (spec.date==='reception'
          ?'reception/'+spec.quality+'/'
          :'floors/'+spec.date+'/'+spec.quality+'/');
      assert.ok(requests.some(url=>url.includes(r2Path)),
        'Tower did not download its R2 mesh pack: '+JSON.stringify({
          requests:requests.filter(x=>x.includes('sculptures-v2')),
          transport:state.transport,
          errors:state.builds.filter(x=>x.state==='failed')
        }));
      assert.ok(state.builds.some(item=>item.state==='complete'&&
        item.transport==='r2'&&item.r2Fallback===false),
        'No prepared sculpture confirmed R2 source');
      for(const item of state.builds.filter(item=>item.state==='complete')){
        assert.equal(item.prepared,true,'Dynamic sculpting used instead of V2 pack');
        assert.ok(item.regions>0,'Missing source pigment regions');
        assert.equal(item.omittedCells,0,'Source pigment omitted');
        assert.ok(item.anchors>=1,'No physical museum pin');
        assert.ok(item.triangles>0,'No curved mesh generated');
        assert.ok(item.extent.every(Number.isFinite),'Invalid sculpture bounds');
        assert.ok(item.extent[2]>.01,'Sculpture has no depth');
        assert.ok(Number.isFinite(item.elapsedMs)&&item.elapsedMs<120000,
          'V2 sculpture load exceeded performance budget');
        assert.ok(Number.isFinite(item.networkMs)&&item.networkMs<120000,
          'V2 prepared pack download exceeded performance budget');
      }
      if(spec.date==='reception'){
        // The normal exhibit inspector runs only AFTER the visitor enters.
        // Inspecting while the welcome screen is up races detectArt(), which
        // intentionally hides artwork panels during the welcome overlay.
        await page.waitForFunction(()=>
          !document.querySelector('#enter')?.disabled,null,{timeout:90000});
        await page.locator('#enter').click({noWaitAfter:true});
        await page.waitForFunction(()=>
          document.querySelector('#welcome')?.hidden,null,{timeout:30000});
        assert.equal(state.failed,0,'Reception statue bake should not fail');
        assert.ok(state.builds.some(x=>x.reception===true&&x.prepared===true));
        await page.waitForFunction(()=>window.__sculptureV2ReceptionInspect);
        const panel=await page.evaluate(()=>{
          window.__sculptureV2ReceptionInspect();
          return{
            title:document.querySelector('#infoTitle')?.textContent,
            seed:document.querySelector('#infoSeed')?.textContent,
            href:document.querySelector('#openArt')?.href,
            hidden:document.querySelector('#info')?.hidden
          };
        });
        assert.equal(panel.title,'Recursive Divisions');
        assert.equal(panel.hidden,false);
        assert.ok(panel.seed.includes('PP-RECEPTION-RECTS-P-20261110'));
        assert.ok(panel.href.includes('mode=rects')&&
          panel.href.includes('fmt=portrait')&&
          panel.href.includes('seed=PP-RECEPTION-RECTS-P-20261110'));
        const portrait=await page.evaluate(()=>new Promise((resolve,reject)=>{
          const img=new Image();
          img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});
          img.onerror=()=>reject(Error('Reception portrait PNG unavailable'));
          img.crossOrigin='anonymous';
          img.src=R2_RECEPTION_IMAGE;
        }));
        assert.deepEqual(portrait,{width:1000,height:1400},
          'Reception V2 image must be a genuinely portrait source');
      }
      assert.deepEqual(errors,[],'Fatal browser errors');
      if(spec.date!=='reception'){
        await page.waitForFunction(()=>
          !document.querySelector('#enter')?.disabled,null,{timeout:90000});
        await page.locator('#enter').click({noWaitAfter:true});
        await page.waitForFunction(()=>
          document.querySelector('#welcome')?.hidden,null,{timeout:30000});
      }
      assert.equal(await page.locator('#welcome').evaluate(el=>el.hidden),true);
      const mounted=await page.evaluate(()=>{
        let count=0;
        const stage=window.__sculptureV2TowerStatus;
        for(const b of stage.builds)if(b.state==='complete')count++;
        return count;
      });
      assert.ok(mounted>0,'No mounted sculptures after entering tower');
      console.log('V2_TOWER_FUNCTIONAL '+JSON.stringify({
        date:spec.date,quality:spec.quality,method:spec.method,
        tested:state.complete,failed:state.failed,
        rooms:startup.phi.roomCount,sculptures:startup.phi.sculptures,
        sourceRegions:state.builds.filter(x=>x.state==='complete')
          .map(x=>x.regions),
        transport:state.transport,outageTest:!!spec.outage,
        preparedLoadMs:state.builds.filter(x=>x.state==='complete')
          .map(x=>x.elapsedMs),
        previewNotProduction:true,visualAssessment:false
      }));
    }finally{await page.close();}
  }
}finally{await browser.close();}
