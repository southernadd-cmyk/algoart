import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({
  headless:true,args:['--disable-dev-shm-usage','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
try{
 for(const config of [
  {date:'2026-11-10',w:1100,h:740,mobile:false},
  {date:'2026-10-22',w:390,h:844,mobile:true}
 ]){
  const page=await browser.newPage({
    viewport:{width:config.w,height:config.h},
    deviceScaleFactor:config.mobile?.5:.65,
    hasTouch:config.mobile,isMobile:config.mobile
  });
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:4173/gallery/hybrid-tower-test/?date='+
    config.date+'&debug',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>
    (window.__hybridTowerStatus&&window.__phiFullEngine)||window.__galleryStartupError,
    null,{timeout:100000});
  assert.ok(requests.some(u=>/\/gallery\/visit\/gallery-phi-hybrid-test-bundle\.js/.test(u)),
    'Test tower imported the LIVE bundle instead of its isolated renderer');
  assert.ok(!requests.some(u=>/\/test\/virtual-gallery\//.test(u)));
  const report=await page.evaluate(()=>({
    route:location.pathname,
    status:window.__hybridTowerStatus,
    phi:window.__phiFullEngine,
    error:window.__galleryStartupError
  }));
  assert.equal(report.route,'/gallery/hybrid-tower-test/');
  assert.equal(report.status?.variant,'hybrid');
  assert.equal(report.status?.connector,'pin');
  assert.equal(report.status?.mode,'test-only-dynamic-hybrid-bake');
  assert.ok(report.phi?.roomCount>0&&report.phi?.sculptures>0,
    'The real archived tower floor did not load');
  await page.waitForFunction(()=>window.__hybridTowerStatus?.complete>0 ||
    window.__hybridTowerStatus?.failed>0,null,{timeout:120000});
  const count=await page.evaluate(()=>({...window.__hybridTowerStatus}));
  assert.ok(count.attempted>0,'No historical portrait sculptures were attempted');
  assert.ok(count.complete>0,'No hybrid source sculptures successfully mounted');
  assert.equal(count.failed,0,
    'Museum-pin hybrid builds failed: '+JSON.stringify(count));
  // All test floor layouts are still managed by the public production
  // architecture. No new walkways, room transforms or layouts are invented.
  if(!config.mobile){
    await page.waitForFunction(()=>window.__hybridTowerStatus?.complete>=
      Math.min(window.__phiFullEngine?.sculptures||1,2),null,{timeout:120000});
  }
  assert.deepEqual(errors,[],'Fatal browser errors: '+errors.join('; '));
  // This is a visual test of the REAL tower, not a welcome-screen capture.
  await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled,
    null,{timeout:90000});
  await page.locator('#enter').click({noWaitAfter:true});
  await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden,
    null,{timeout:30000});
  const sceneReady=await page.evaluate(()=>({
    date:window.__phiFullEngine?.date,
    rendered:window.__hybridTowerStatus?.complete,
    hidden:document.querySelector('#welcome')?.hidden
  }));
  assert.equal(sceneReady.hidden,true);
  assert.ok(sceneReady.rendered>0,'The entry floor has no mounted hybrid sculptures');
  await page.screenshot({
    path:'/tmp/hybrid-tower-'+(config.mobile?'mobile':'desktop')+'.png',
    timeout:60000
  });
  console.log('HYBRID_TOWER_SMOKE '+JSON.stringify({
    date:config.date,mobile:config.mobile,attempted:count.attempted,
    complete:count.complete,failed:count.failed,floors:report.phi.roomCount,
    sculptures:report.phi.sculptures
  }));
  await page.close();
 }
}finally{await browser.close();}
