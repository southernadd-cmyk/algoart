import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
await mkdir('phi-tower-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const options of [{viewport:{width:1200,height:800},deviceScaleFactor:1},{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}]){
  const context=await browser.newContext(options),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  const url='http://127.0.0.1:4173/gallery/visit/?date=2026-10-07&debug';
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.getElementById('enter').disabled,null,{timeout:90000});
  assert.equal(await page.evaluate(()=>window.__phiFullEngine.date),'2026-10-07');assert.match(await page.locator('#floorIndicator').innerText(),/7 Oct · Floor 3/);
  assert.equal(await page.locator('#error').isVisible(),false);assert.ok(!requests.some(u=>/cdn\.jsdelivr|test\/virtual-gallery|tower-geometry\.bin/.test(u)));
  await page.locator('#enter').focus();await page.keyboard.press('Enter');
  if(options.isMobile){
   const before=await page.evaluate(()=>window.__phiLiftState.yaw),touch=await context.newCDPSession(page);
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:400}]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:260,y:400}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(y=>Math.abs(window.__phiLiftState.yaw-y)>.1,before,{timeout:10000});
   assert.ok(await page.locator('#touchNav').isVisible());await page.screenshot({path:'phi-tower-results/public-touch.png'});
  }
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.getElementById('enter').disabled,null,{timeout:90000});assert.equal(await page.evaluate(()=>window.__phiFullEngine.date),'2026-10-07');
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Public dated entry, refresh, touch look and mobile viewport passed at full pixel density');
}finally{await browser.close();}
