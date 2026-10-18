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
  await page.evaluate(()=>document.getElementById('introSplash').hidden=false);
  const intro=await page.evaluate(()=>({width:document.querySelector('.welcome-composition').scrollWidth,viewport:innerWidth,scrollHeight:document.querySelector('#introSplash').scrollHeight,height:innerHeight,artwork:document.querySelector('.welcome-right img').complete}));
  assert(intro.width<=intro.viewport,'Welcome composition must fit viewport');
  assert(intro.scrollHeight<=intro.height+2,'Welcome screen must not vertically scroll');
  assert(intro.artwork,'Welcome artwork must load');
  await page.screenshot({path:'editorial-preview-results/'+(mobile?'welcome-mobile':'welcome-desktop')+'.png'});
  await page.evaluate(()=>document.getElementById('introSplash').hidden=true);
  await page.goto('http://127.0.0.1:4173/test/gallery/',{waitUntil:'domcontentloaded'});
  await page.locator('.exhibition .work img').first().waitFor();
  const gallery=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,count:document.querySelectorAll('.exhibition .work').length,broken:[...document.querySelectorAll('.exhibition img')].filter(i=>!i.complete||!i.naturalWidth).length}));
  await page.waitForFunction(()=>[...document.querySelectorAll('.exhibition img')].every(i=>i.complete),{timeout:30000});
  assert(gallery.width<=gallery.viewport+2,'Gallery overflows viewport');
  assert.equal(gallery.count,6);
  await page.screenshot({path:'editorial-preview-results/'+(mobile?'gallery-mobile':'gallery-desktop')+'.png',fullPage:true});
  await page.goto('http://127.0.0.1:4173/test/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#statsText')?.textContent?.trim()?.length>0&&document.getElementById('creatingOverlay')?.hidden===true,{timeout:120000});
  const state=await page.evaluate(()=>({
   path:location.pathname,art:document.getElementById('art').width,
   controls:['seed','materialStyle','palette','colourCount','elements','density','complexity','negativeSpace','plotterPaper','orientation'].every(id=>!!document.getElementById(id)),
   paper:getComputedStyle(document.body).backgroundColor,
   inspector:!!document.querySelector('#inspector .tabs'),
   columns:getComputedStyle(document.querySelector('#app main')).gridTemplateColumns
  }));
  assert.equal(state.path,'/test/');
  assert(state.art>0);
  assert(state.controls&&state.inspector);
  assert.deepEqual(errors,[]);
  if(mobile){
   const layout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,screen:innerWidth,actions:[...document.querySelectorAll('.toolbar .actions > *')].map(el=>({text:el.textContent.trim(),right:el.getBoundingClientRect().right,top:el.getBoundingClientRect().top})),tabs:document.querySelector('.tabs')?.getBoundingClientRect().toJSON()}));
   assert(layout.width<=layout.screen+2,'mobile document overflows viewport: '+JSON.stringify(layout));
   assert(layout.actions.every(x=>x.right<=layout.screen+2),'mobile toolbar action clipped: '+JSON.stringify(layout.actions));
  }
  await page.screenshot({path:'editorial-preview-results/'+(mobile?'mobile-390':'desktop-1440')+'.png',fullPage:true});
  console.log(mobile?'MOBILE':'DESKTOP',state);
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  const prod=await page.evaluate(()=>({welcome:!!document.querySelector('.welcome-layout'),controls:!!document.querySelector('#materialStyle'),sheet:!!document.querySelector('.studio-question'),width:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert(prod.welcome&&prod.controls&&prod.sheet,'Production studio must use editorial layout and preserve controls');
  if(!mobile){
   const order=await page.evaluate(()=>{const h=document.querySelector('#inspector > .inspector-head').getBoundingClientRect(),t=document.querySelector('#inspector > .tabs').getBoundingClientRect(),b=document.querySelector('#inspector > .tab-body').getBoundingClientRect();return {header:h.top,tabs:t.top,body:b.top,headerBottom:h.bottom,tabsBottom:t.bottom};});
   assert(order.headerBottom<=order.tabs+3&&order.tabsBottom<=order.body+3,'Desktop Parameters header must precede tabs and content: '+JSON.stringify(order));
   await page.screenshot({path:'editorial-preview-results/production-parameters-desktop.png'});
  }

  assert(prod.width<=prod.viewport+2,'Production studio horizontal overflow');
  await page.goto('http://127.0.0.1:4173/gallery/2026-10-17/',{waitUntil:'domcontentloaded'});
  const day=await page.evaluate(()=>({css:[...document.styleSheets].some(x=>x.href?.includes('editorial.css')),cards:document.querySelectorAll('.art-card').length,width:document.documentElement.scrollWidth,viewport:innerWidth,remix:!!document.querySelector('.art-card .remix')}));
  assert(day.css&&day.cards===16&&day.remix,'Full-day gallery must retain all works and links with editorial style');
  assert(day.width<=day.viewport+2,'Full-day gallery horizontal overflow');
  await page.screenshot({path:'editorial-preview-results/'+(mobile?'release-day-mobile':'release-day-desktop')+'.png',fullPage:true});
  await context.close();
 }
}finally{await browser.close()}
