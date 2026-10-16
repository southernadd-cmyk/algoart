import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'?v=9&seed=V5Q-OIL-D7ADDCCC68&mode=spiral&material=oil-v1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#materialStyle')?.value==='oil' && typeof window.AlgoArt?.renderOilPaintV2==='function');
 const legacy=await page.evaluate(()=>({
  options:[...document.querySelector('#materialStyle').options].filter(o=>o.value.startsWith('oil')).map(o=>o.textContent),
  url:location.search,
  note:document.querySelector('#materialStyleNote').textContent,
  exportVersion:(()=>{const A=window.AlgoArt,s=A.readSettings();const c=document.createElement('canvas');return A.renderOilPaintV1(c,s,.2,false).version})()
 }));
 assert.deepEqual(legacy.options,['Oil Paint']);
 assert.match(legacy.url,/material=oil-v1/);
 assert.match(legacy.note,/Oil Paint v1 \(legacy\)/);
 assert.equal(legacy.exportVersion,'oil-paint-v1');
 await page.locator('#materialStyle').selectOption('marker');
 await page.locator('#materialStyle').selectOption('oil');
 await page.waitForFunction(()=>location.search.includes('material=oil-v2'));
 const now=await page.evaluate(()=>{
  const A=window.AlgoArt,s=A.readSettings(),c=document.createElement('canvas');
  return {version:A.renderOilPaintV2(c,s,.2,false).version,oilOptions:[...document.querySelector('#materialStyle').options].filter(o=>o.value.startsWith('oil')).length};
 });
 assert.equal(now.version,'oil-paint-v2');
 assert.equal(now.oilOptions,1);
 assert.deepEqual(errors,[]);
 console.log('PASS: one Oil Paint option, legacy link still V1, new selection V2');
}finally{await browser.close()}
