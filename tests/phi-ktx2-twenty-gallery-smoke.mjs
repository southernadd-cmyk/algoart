// Public test deployment ONLY. Assert opt-in 20-candidate bank works in the
// actual reception without changing the live tower or artwork materials.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url='https://southernadd-cmyk.github.io/algoart/test/virtual-gallery/full-engine.html?ktx2=20&debug=1';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:1});
 const errors=[],responses=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('response',r=>{
  if(r.url().includes('/ktx2-20/')&&r.url().endsWith('.ktx2'))
   responses.push({name:r.url().split('/').at(-1),status:r.status()});
 });
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>['loaded','partial-fallback'].includes(window.__phiKTX20?.status),
  null,{timeout:110000});
 const result=await page.evaluate(()=>({
  bank:window.__phiKTX20||null,
  error:window.__galleryStartupError||null,
  enterEnabled:!document.querySelector('#enter')?.disabled,
  pilot:window.__phiKTX2Pilot||null
 }));
 console.log('KTX20_TOWER '+JSON.stringify({result,responses,errors}));
 assert.equal(result.error,null,'No tower startup errors');
 assert.equal(result.bank.status,'loaded','Eight scene maps must load without JPG fallback');
 assert.equal(result.bank.candidateCount,20);
 assert.equal(result.bank.sceneCandidates,8);
 assert.equal(result.bank.loaded,8);
 assert.equal(result.bank.failed,0);
 assert.equal(responses.filter(r=>r.status===200).length,8);
 assert.deepEqual(errors,[]);
 await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled,null,{timeout:100000});
 await page.locator('#enter').press('Enter');
 await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,null,{timeout:15000});
 console.log('KTX20_TOWER_SMOKE_PASS');
}finally{await browser.close();}
