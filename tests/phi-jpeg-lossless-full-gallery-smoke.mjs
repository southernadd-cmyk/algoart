// Pixel-exact KTX2 full gallery TEST ONLY. Verify actual floor preloading and
// paintings, not just isolated texture transcode. This is software SwiftShader
// correctness testing, not a hardware performance estimate.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
try{
 const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:1});
 const failures=[];
 page.on('pageerror',error=>failures.push(String(error)));
 await page.goto('https://southernadd-cmyk.github.io/algoart/test/virtual-gallery/full-engine.html?debug=1&jpegformat=lossless',
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled||
   !!window.__galleryStartupError,null,{timeout:100000});
 const start=await page.evaluate(()=>({
  error:window.__galleryStartupError||'',
  diagnostic:window.__phiJPEGLossless||null,
  startup:window.__galleryStage||null
 }));
 assert.equal(start.error,'','No tower startup errors');
 assert.ok(start.diagnostic?.enabled,'Whole-archive lossless bank enabled');
 console.log('LOSSLESS_REAL_TOWER_ENTRY '+JSON.stringify(start));
 await page.locator('#enter').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,
  null,{timeout:20000});
 await page.waitForFunction(()=>window.__phiJPEGLossless?.architectural>=2,
  null,{timeout:100000});
 await page.locator('#openLift').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#lift')?.hidden===false,
  null,{timeout:12000});
 await page.locator('#liftDays button.lift-available:not(.lift-current)').first().evaluate(el=>el.click());
 await page.waitForFunction(()=>window.__phiLiftState?.floor>0&&!window.__phiLiftState?.travelling,
  null,{timeout:115000});
 await page.waitForFunction(()=>window.__phiJPEGLossless?.artworks>=1,
  null,{timeout:70000});
 const report=await page.evaluate(()=>({
  floor:window.__phiLiftState?.floor,
  status:window.__galleryStartupError||'',
  pictures:window.__phiFullEngine?.paintingsLoaded||0,
  textures:window.__phiJPEGLossless,
  renderer:window.__phiRenderStats||null
 }));
 console.log('LOSSLESS_REAL_TOWER_REPORT '+JSON.stringify(report));
 assert.ok(report.floor>0);
 assert.ok(report.textures.artworks>=1,'Archived paintings loaded in lossless format');
 assert.equal(report.textures.mode,'lossless-RGBA8-Zstd');
 assert.deepEqual(failures,[],'No page JavaScript errors');
 console.log('LOSSLESS_REAL_TOWER_SMOKE_PASS');
}finally{await browser.close();}
