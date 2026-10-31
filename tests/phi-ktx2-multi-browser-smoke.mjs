import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base='https://southernadd-cmyk.github.io/algoart/test/virtual-gallery/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:1});
 const errors=[],requested=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('response',r=>{
  if(/(Bricks055_(NormalGL|Roughness)|OfficeCeiling001_NormalGL)\.ktx2/.test(r.url()))
   requested.push({url:r.url(),status:r.status()});
 });
 await page.goto(base+'full-engine.html?ktx2=multi&debug=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>['loaded','partial-fallback','fallback-jpg'].includes(window.__phiKTX2Pilot?.status),
  null,{timeout:110000});
 const state=await page.evaluate(()=>({pilot:window.__phiKTX2Pilot,errors:window.__galleryStartupError||null,
  enterAvailable:!document.querySelector('#enter')?.disabled}));
 console.log('MULTI_KTX_RUNTIME '+JSON.stringify({state,requested,errors}));
 assert.equal(state.errors,null,'Gallery startup must not fail');
 assert.equal(state.pilot.status,'loaded','All three architectural KTX2 maps must load');
 assert.equal(state.pilot.compressedCount,3);
 for(const key of ['brick-normal','brick-roughness','ceiling-normal']){
  assert.equal(state.pilot.assets[key]?.status,'loaded',key);
  assert.equal(state.pilot.assets[key]?.compressed,true,key);
  assert.ok(state.pilot.assets[key]?.bytes>1000,key+' should contain GPU-compressed data');
 }
 assert.equal(requested.filter(x=>x.status===200).length,3,'Three different KTX2 requests should succeed');
 assert.deepEqual(errors,[],'No uncaught browser errors');

 const benchmark=await browser.newPage();
 const uiErrors=[];benchmark.on('pageerror',e=>uiErrors.push(String(e)));
 await benchmark.goto(base+'ktx2-comparison.html',{waitUntil:'load',timeout:30000});
 assert.equal(await benchmark.locator('#run').count(),1);
 assert.equal(await benchmark.locator('#tower').count(),1);
 assert.deepEqual(uiErrors,[],'Hardware benchmark page should parse without errors');
 console.log('MULTI_KTX_SMOKE_PASS');
}finally{await browser.close();}
