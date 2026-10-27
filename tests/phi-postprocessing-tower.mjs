import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const target=process.env.PHI_POST_TEST_URL||'http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
await mkdir('phi-postprocessing-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const mode of (process.env.PHI_POST_TEST_URL||process.env.PHI_SHADOW_TEST?['ao']:['off','composer','ao','fxaa','ao-fxaa'])){
  const page=await browser.newPage({viewport:{width:960,height:600}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/shader|WebGL|Post test/i.test(message.text()))errors.push(message.text());});
  const url=new URL(target);url.searchParams.set('post',mode);url.searchParams.set('debug','');
  if(process.env.PHI_SHADOW_TEST)url.searchParams.set('shadows','1');
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__phiPostTest?.ready,{timeout:120000});
  // A successful shader compilation does not prove that import.meta.url asset
  // requests survived bundling. Require the actual reception tile image.
  await page.waitForFunction(()=>window.__phiReceptionTiles?.map?.image?.width>1,{timeout:30000});
  // Keyboard activation avoids pointer lock and automated mouse movements
  // changing the inspection camera while opening the comparison controls.
  await page.locator('#enter').press('Enter');
  await page.waitForTimeout(2500);
  await page.locator('#phi-post-test summary').click();
  await page.screenshot({path:`phi-postprocessing-results/${mode}.png`});
  await page.locator('#openLift').click();
  await page.waitForTimeout(250);
  await page.locator('#closeLift').click();
  if(mode==='ao'){
   await page.locator('#openLift').click();
   await page.locator('#liftDays button.lift-available:not(.lift-current)').first().click();
   await page.waitForFunction(()=>window.__phiLiftState?.floor>0&&!window.__phiLiftState.travelling,{timeout:120000});
   await page.waitForTimeout(1500);
   await page.screenshot({path:'phi-postprocessing-results/ao-floor-arrival.png'});
  }
  const state=await page.evaluate(()=>({post:window.__phiPostTest,floor:window.__phiLiftState}));
  assert.equal(state.post.error,null);assert.equal(state.post.mode,mode);assert.deepEqual(errors,[]);
  if(process.env.PHI_SHADOW_TEST){assert.equal(state.post.shadows.enabled,true);assert.ok(state.post.shadows.roomLights>0);}
  results.push({mode,...state});console.log(mode,JSON.stringify(state));
  await page.close();
 }
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await mobile.goto(target,{waitUntil:'domcontentloaded'});
 await mobile.waitForFunction(()=>window.__phiPostTest?.ready,{timeout:120000});
 assert.equal(await mobile.evaluate(()=>window.__phiPostTest.mode),'off');
 await mobile.screenshot({path:'phi-postprocessing-results/mobile-default.png'});
 await writeFile('phi-postprocessing-results/measurements.json',JSON.stringify(results,null,2));
 console.log('PASS: selected tower modes, lift calendar, AO floor transition, mobile baseline. Software timings only.');
}finally{await browser.close();}
