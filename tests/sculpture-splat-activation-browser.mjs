import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base='https://southernadd-cmyk.github.io/algoart/';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const scenario of [
  {name:'reception desktop',query:'?debug',expected:1,viewport:{width:1100,height:800}},
  {name:'dated mobile',query:'?date=2026-11-25&debug',date:'2026-11-25',viewport:{width:390,height:844},isMobile:true},
  {name:'explicit rollback',query:'?sculptures=mesh&debug',mesh:true,viewport:{width:1000,height:700}},
  {name:'missing splat fallback',query:'?debug',missing:true,viewport:{width:1000,height:700}}
 ]){
  const context=await browser.newContext({viewport:scenario.viewport,isMobile:!!scenario.isMobile,hasTouch:!!scenario.isMobile,deviceScaleFactor:1,serviceWorkers:'block'});
  // Serve the candidate build at the approved public origin while keeping
  // genuine cross-origin R2 requests and real Spark unchanged.
  await context.route(base+'**',async route=>{
   const u=new URL(route.request().url());
   const local='http://127.0.0.1:4173/'+u.pathname.slice('/algoart/'.length)+u.search;
   try{const response=await route.fetch({url:local});await route.fulfill({response});}
   catch(e){await route.abort();}
  });
  if(scenario.missing)await context.route('**/sculptures-splats/v1/**/manifest.json',route=>route.fulfill({status:404,headers:{'access-control-allow-origin':'https://southernadd-cmyk.github.io'}}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'gallery/visit/'+scenario.query,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__phiFullEngine&&window.__sculptureV2TowerStatus?.complete>0,null,{timeout:120000});
  if(scenario.date)assert.equal(await page.evaluate(()=>window.__phiFullEngine.date),scenario.date);
  if(scenario.mesh){
   assert.equal(await page.evaluate(()=>window.__ppSculptureMode),'mesh');
   assert.equal(await page.evaluate(()=>typeof window.__sculptureSplats),'undefined');
   assert.match(page.url(),/sculptures=mesh/);
  }else if(scenario.missing){
   await page.waitForFunction(()=>window.__sculptureSplats?.().failed>0,null,{timeout:60000});
   assert.equal(await page.evaluate(()=>window.__sculptureSplats().active),0);
  }else{
   await page.waitForFunction(expected=>window.__sculptureSplats?.().active>=(expected||window.__phiFullEngine.sculptures)&&window.__sculptureSplats?.().active>0,scenario.expected||0,{timeout:120000});
   const stats=await page.evaluate(()=>window.__sculptureSplats());
   assert.equal(stats.failed,0,JSON.stringify(stats));assert.equal(stats.disabled,false);
   assert.equal(stats.packLoads,1,'One shared public pack per edition');
   assert.ok(stats.cacheBytes>0&&stats.cacheBytes<=24*1048576,'Bounded decoded point cache');
   assert.ok(stats.constructedPoints>=stats.ready*12000,'No quality reduction during optimization');
   assert.equal(await page.evaluate(()=>window.__ppSculptureMode),'splats');
  }
  await page.waitForFunction(()=>!document.getElementById('enter').disabled,null,{timeout:120000});
  await page.locator('#enter').click();
  await page.waitForFunction(()=>document.getElementById('welcome').hidden,null,{timeout:30000});
  if(!scenario.mesh&&!scenario.missing){
   const after=await page.evaluate(()=>window.__sculptureSplats());
   assert.equal(after.failed,0);assert.equal(after.disabled,false);
   assert.equal(after.packLoads,1);
  }
  assert.deepEqual(errors,[],scenario.name+' browser errors');
  console.log('GS6_BROWSER_OK',scenario.name,await page.evaluate(()=>({mode:window.__ppSculptureMode,splats:window.__sculptureSplats?.(),v2Complete:window.__sculptureV2TowerStatus.complete})));
  await context.close();
 }
}finally{await browser.close();}
