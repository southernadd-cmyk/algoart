import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
await mkdir('phi-tower-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const options of [{viewport:{width:1200,height:800},deviceScaleFactor:1},{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}]){
  const context=await browser.newContext(options),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),type:r.resourceType()}));
  const url='http://127.0.0.1:4173/gallery/visit/?date=2026-10-07&debug';
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.getElementById('enter').disabled,null,{timeout:90000});
  assert.equal(await page.evaluate(()=>window.__phiFullEngine.date),'2026-10-07');assert.match(await page.locator('#floorIndicator').innerText(),/7 Oct · Floor 3/);
  assert.equal(await page.locator('#error').isVisible(),false);assert.deepEqual(requests.filter(({url,type})=>/\/test\/virtual-gallery\//.test(url)||/tower-geometry\.bin/.test(url)||(['script','stylesheet','font'].includes(type)&&new URL(url).origin!=='http://127.0.0.1:4173')),[],'Public date entry must not import test assets, legacy geometry or external scripts');
  await page.locator('#enter').focus();await page.keyboard.press('Enter');
  if(options.isMobile){
   await page.waitForFunction(()=>document.getElementById('welcome').hidden);
   const before=await page.evaluate(()=>window.__phiLiftState.yaw);
   const origin=await page.evaluate(()=>{
    for(const y of [460,380,560,650])for(const x of [180,260,90])
     if(document.elementFromPoint(x,y)?.id==='world')return {x,y};
    return null;
   });
   assert.ok(origin,'No unobstructed canvas point for mobile touch drag');
   const touch=await context.newCDPSession(page);
   const point=(x,y)=>[{x,y,id:0,force:1}];
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(origin.x,origin.y)});
   await page.waitForTimeout(120);
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(origin.x+50,origin.y)});
   await page.waitForTimeout(120);
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(origin.x+110,origin.y)});
   await page.waitForTimeout(120);
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(y=>Math.abs(window.__phiLiftState.yaw-y)>.1,before,{timeout:10000});
   assert.ok(await page.locator('#touchNav').isVisible());await page.screenshot({path:'phi-tower-results/public-touch.png'});
  }
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.getElementById('enter').disabled,null,{timeout:90000});assert.equal(await page.evaluate(()=>window.__phiFullEngine.date),'2026-10-07');
  assert.deepEqual(errors,[]);await context.close();
 }

 // Regression: the test backroom monitor used to silently return null because
 // phi.world is assigned AFTER constructPhiGallery. Verify the real browser
 // scene contains three separately rendered monitor screens, not just a planner.
 {
  const context=await browser.newContext({viewport:{width:1200,height:800},deviceScaleFactor:.75});
  const page=await context.newPage();
  const failures=[],testRequests=[];
  page.on('pageerror',err=>failures.push(err.message));
  page.on('request',request=>testRequests.push(request.url()));
  await page.goto('http://127.0.0.1:4173/test/virtual-gallery/full-engine.html?debug&svg-export',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__phiLivingMonitorDiagnostics?.placed || !document.getElementById('error')?.hidden,null,{timeout:90000});
  const monitors=await page.evaluate(()=>{
   const scene=window.__PP_EXPORT_SCENE__?.scene;
   const root=scene?.getObjectByName('phi-reception-three-living-monitors');
   const screens=[];
   root?.traverse(child=>{if(child.name==='monitor-screen')screens.push(child);});
   const diag=window.__phiLivingMonitorDiagnostics;
   return {placed:diag?.placed,count:diag?.screenCount,screenMeshes:screens.length,
    wall:diag?.wall,media:diag?.media,position:root?.position.toArray(),error:document.getElementById('error')?.textContent};
  });
  assert.equal(monitors.placed,true,'Monitor creation must succeed during reception construction');
  assert.equal(monitors.count,3,'Expected three reception monitors');
  assert.equal(monitors.screenMeshes,3,'Expected three actual screen meshes in the active scene');
  assert.equal(monitors.wall?.fromPhysical,true,'Monitors must attach to real backroom wall geometry');
  assert.equal(monitors.media?.state,'fallback','TouchDesigner must not load media at gallery startup');
  assert.equal(testRequests.filter(url=>url.includes('phase-one-triptych.webm')).length,0,
   'Video decoder should never start at gallery startup');
  assert.deepEqual(failures,[],'Test gallery generated browser errors');
  console.log('Three test reception monitors created in scene:',monitors);
  await context.close();
 }
 console.log('Public dated entry, refresh, touch look and mobile viewport passed at full pixel density');
}finally{await browser.close();}
