import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {LAB_URL,routeLabCheckout} from './sculpture-lab-browser-checkout.mjs';

const browser=await chromium.launch({headless:true,args:[
  '--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
const ready=page=>page.waitForFunction(()=>window.__sculptureLabStatus?.ready||
  window.__sculptureLabStatus?.error,undefined,{timeout:120000});
const state=page=>page.evaluate(()=>window.__sculptureLabStatus);
function assertPublished(lab,quality){
  assert.equal(lab.ready,true,JSON.stringify(lab));
  assert.equal(lab.engine,'published-r2');
  assert.equal(lab.prepared,true);
  assert.equal(lab.transport.source,'r2');
  assert.equal(lab.transport.fallback,false);
  assert.equal(lab.methods.length,1);
  const model=lab.methods[0];
  assert.equal(model.method,'assembly');
  assert.equal(model.sourceCoverage,1);
  assert.equal(model.omittedCells,0);
  assert.ok(model.regionCount>0&&model.polygonTriangles>0);
  assert.ok(model.extent.every(value=>value>0));
  assert.equal(model.support,'pin');
  assert.ok(model.supportAnchors>0);
  assert.equal(lab.quality,quality);
}
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[],failures=[],packs=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{
    if(!r.ok())failures.push([r.status(),r.url()]);
    if(r.url().includes('.workers.dev/')&&r.url().endsWith('.json.gz'))packs.push(r.url());
  });
  await routeLabCheckout(page);
  await page.goto(LAB_URL,{waitUntil:'domcontentloaded'});
  await ready(page);
  let lab=await state(page);
  assertPublished(lab,'desktop');
  assert.ok(lab.sourceImage.startsWith('https://proportion-piece-media.'));
  assert.equal(await page.locator('#depth').isDisabled(),true);
  const portraits=await page.locator('#painting option').evaluateAll(options=>options.map(o=>o.value));
  assert.ok(portraits.length>1);
  for(const file of portraits.slice(1)){
    await page.locator('#painting').selectOption(file);
    await ready(page);lab=await state(page);
    assertPublished(lab,'desktop');assert.equal(lab.imageFile,file);
  }
  assert.equal(packs.length,1,'Portrait changes should reuse the verified daily pack');
  for(const view of ['front','side','back','threequarter'])await page.locator('#'+view).click();
  await page.screenshot({path:'/tmp/sculpture-lab-r2-desktop.png'});
  // Historical geometry is R2 too, while its source JPEG remains in Pages.
  await page.locator('#day').selectOption('2026-11-10');
  await ready(page);lab=await state(page);assertPublished(lab,'desktop');
  assert.ok(lab.sourceImage.includes('/gallery/2026-11-10/'));
  // Both old experimental renderers still use the selected original source.
  for(const mode of ['v4','v3']){
    await page.locator('#engineMode').selectOption(mode);
    await ready(page);lab=await state(page);
    assert.equal(lab.ready,true,JSON.stringify(lab));
    assert.equal(lab.version,mode==='v4'?4:3);
    assert.equal(lab.methods.length,4);
    assert.equal(await page.locator('#depth').isDisabled(),false);
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(LAB_URL,{waitUntil:'domcontentloaded'});
  await ready(page);assertPublished(await state(page),'mobile');
  await page.locator('#settingsToggle').click();
  assert.equal(await page.locator('#engineMode').isVisible(),true);
  await page.locator('#settingsToggle').click();
  await page.locator('#side').click();
  await page.screenshot({path:'/tmp/sculpture-lab-r2-mobile.png'});
  assert.deepEqual(errors,[]);
  assert.deepEqual(failures,[]);
  // A failed download must be visible, never silently rebuild an approximation.
  await page.route('https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev/**',
    route=>route.fulfill({status:503,body:'Simulated unavailable R2 sculpture',
      headers:{'access-control-allow-origin':'https://southernadd-cmyk.github.io'}}));
  await page.reload({waitUntil:'domcontentloaded'});
  await ready(page);lab=await state(page);
  assert.equal(lab.ready,false);
  assert.match(lab.error,/HTTP 503/);
  assert.ok((await page.locator('#status').textContent()).includes('503'));
  console.log('Published R2 lab: all current portraits, historical source, V3/V4, mobile, outage verified');
}finally{await browser.close();}
