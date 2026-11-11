// Canary-specific regression: R2-backed gallery artwork must populate the intro,
// even if the R2 host is temporarily blocked and the archived JPEG fallback is used.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const context=await browser.newContext({viewport:{width:1140,height:820}});
  await context.route('https://proportion-piece-media.mr-adam-clement.workers.dev/**',route=>route.abort('failed'));
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>{
    const splash=document.getElementById('introSplash');
    const frame=document.querySelector('.welcome-right');
    const picture=frame?.querySelector('img');
    return splash&&!splash.hidden&&frame&&!frame.classList.contains('welcome-loading')&&
      picture?.complete&&picture.naturalWidth>=100&&picture.style.visibility==='visible';
  },undefined,{timeout:90000});
  const state=await page.evaluate(()=>({
    href:location.href,caption:document.querySelector('.welcome-right figcaption').textContent.trim(),
    src:document.querySelector('.welcome-right img').src,
    width:document.querySelector('.welcome-right img').naturalWidth,
    overlay:document.querySelector('.welcome-right').classList.contains('welcome-loading')
  }));
  assert.ok(state.caption.length>4,'Missing artwork title');
  assert.ok(state.src.startsWith('http://127.0.0.1:4173/gallery/2026-11-11/'),state.src);
  assert.ok(state.width>=100);
  assert.equal(state.overlay,false);
  assert.deepEqual(errors,[],'Welcome browser exception: '+errors.join('; '));
  console.log('CANARY_WELCOME_R2_FALLBACK_OK '+JSON.stringify(state));

  // User's exact Oil V8 shared state is a deep link, not a first-visit splash.
  const url='http://127.0.0.1:4173/?v=10&seed=OQKLI-7801&mode=field&el=80&den=61&cx=11&neg=15&phi=83&rec=4&spi=61&ga=24&nest=53&pen=dry&th=17&wob=2&od=2&op=44&pr=99&dry=56&curve=6&shape=61&overlap=31&rot=71&ln=1&ci=1&re=1&po=1&ar=1&pal=earth&cols=11&sat=83&bri=48&paper=%23f5f0e6&grain=94&material=oil-v8';
  const direct=await context.newPage();
  const directErrors=[];
  direct.on('pageerror',err=>directErrors.push(err.message));
  const directResp=await direct.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(directResp.status(),200);
  await direct.waitForFunction(()=>{
    const stats=document.getElementById('statsText')?.textContent||'';
    return document.getElementById('introSplash')?.hidden===true&&
      document.getElementById('creatingOverlay')?.hidden!==false&&
      stats.includes('Oil paint')&&window.AlgoArt?.lastOilV8Render?.version==='oil-paint-v8';
  },undefined,{timeout:120000});
  assert.deepEqual(directErrors,[],'Direct Oil V8 errors: '+directErrors.join('; '));
  console.log('CANARY_OIL_V8_DEEPLINK_OK '+(await direct.title()));
  await direct.close();
  await page.close();
}finally{await browser.close();}
