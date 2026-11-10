// Functional only: no screenshots, visual comparison or automated art judgement.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({
 headless:true,args:['--disable-dev-shm-usage','--use-gl=angle',
 '--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
try{
  for(const spec of [
    {date:'2026-11-10',quality:'desktop',width:1100,height:740,method:'assembly'},
    {date:'2026-10-22',quality:'mobile',width:390,height:844,method:'assembly'},
    {date:'reception',quality:'desktop',width:1100,height:740,method:'assembly'},
    {date:'reception',quality:'mobile',width:390,height:844,method:'assembly'}
  ]){
    const page=await browser.newPage({
      viewport:{width:spec.width,height:spec.height},
      deviceScaleFactor:spec.quality==='mobile'?.5:.65,
      hasTouch:spec.quality==='mobile',isMobile:spec.quality==='mobile'
    });
    const errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>requests.push(request.url()));
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
      assert.equal(state.failed,0,'V2 sculpture failed: '+JSON.stringify(state.builds));
      assert.ok(state.complete>0,'No V2 sculpture completed');
      const expectedPack=spec.date==='reception'
        ?'/gallery/sculpture-v2-test/reception/sculptures.'+spec.quality+'.json.gz'
        :'/gallery/'+spec.date+'/3d/v2/sculptures.'+spec.quality+'.json.gz';
      assert.ok(requests.some(url=>url.includes(expectedPack)),
        'Tower did not actually request its prepared mesh pack');
      for(const item of state.builds.filter(item=>item.state==='complete')){
        assert.equal(item.prepared,true,'Dynamic sculpting used instead of V2 pack');
        assert.ok(item.regions>0,'Missing source pigment regions');
        assert.equal(item.omittedCells,0,'Source pigment omitted');
        assert.ok(item.anchors>=1,'No physical museum pin');
        assert.ok(item.triangles>0,'No curved mesh generated');
        assert.ok(item.extent.every(Number.isFinite),'Invalid sculpture bounds');
        assert.ok(item.extent[2]>.01,'Sculpture has no depth');
      }
      if(spec.date==='reception'){
        assert.equal(state.failed,0,'Reception statue bake should not fail');
        assert.ok(state.builds.some(x=>x.reception===true&&x.prepared===true));
        await page.waitForFunction(()=>window.__sculptureV2ReceptionInspect);
        await page.evaluate(()=>window.__sculptureV2ReceptionInspect());
        const panel=await page.evaluate(()=>({
          title:document.querySelector('#infoTitle')?.textContent,
          seed:document.querySelector('#infoSeed')?.textContent,
          href:document.querySelector('#openArt')?.href,
          hidden:document.querySelector('#info')?.hidden
        }));
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
          img.src='/gallery/sculpture-v2-test/reception/recursive-divisions-portrait.png';
        }));
        assert.deepEqual(portrait,{width:1000,height:1400},
          'Reception V2 image must be a genuinely portrait source');
      }
      assert.deepEqual(errors,[],'Fatal browser errors');
      await page.waitForFunction(()=>
        !document.querySelector('#enter')?.disabled,null,{timeout:90000});
      await page.locator('#enter').click({noWaitAfter:true});
      await page.waitForFunction(()=>
        document.querySelector('#welcome')?.hidden,null,{timeout:30000});
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
        previewNotProduction:true,visualAssessment:false
      }));
    }finally{await page.close();}
  }
}finally{await browser.close();}
