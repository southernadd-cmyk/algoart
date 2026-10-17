import {chromium,devices} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
await mkdir('editorial-preview-results',{recursive:true});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext(mobile?{...devices['Pixel 7']}:{viewport:{width:1440,height:900}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('algoart-intro-seen','1');localStorage.setItem('algoart-ethos-seen','1')});
  await page.goto('http://127.0.0.1:4173/test/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#statsText')?.textContent?.trim()?.length>0&&document.getElementById('creatingOverlay')?.hidden===true,{timeout:120000});
  const state=await page.evaluate(()=>({
   path:location.pathname,art:document.getElementById('art').width,
   controls:['seed','materialStyle','palette','colourCount','elements','density','complexity','negativeSpace','plotterPaper','orientation'].every(id=>!!document.getElementById(id)),
   paper:getComputedStyle(document.body).backgroundColor,
   inspector:!!document.querySelector('#inspector .tabs'),
   columns:getComputedStyle(document.querySelector('#app main')).gridTemplateColumns,
   width:document.documentElement.scrollWidth,
   viewport:window.innerWidth,
   actionRects:[...document.querySelectorAll('.toolbar .actions>*')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width}})
  }));
  assert.equal(state.path,'/test/');
  assert(state.art>0);
  assert(state.controls&&state.inspector);
  assert.deepEqual(errors,[]);
  if(mobile){assert(state.width<=state.viewport+2,'Page must not overflow mobile width');assert(state.actionRects.every(r=>r.x>=-2&&r.right<=state.viewport+2),'Every toolbar action must fit phone screen');}
  await page.screenshot({path:'editorial-preview-results/'+(mobile?'mobile-390':'desktop-1440')+'.png',fullPage:true});
  console.log(mobile?'MOBILE':'DESKTOP',state);
  await context.close();
 }
}finally{await browser.close()}
