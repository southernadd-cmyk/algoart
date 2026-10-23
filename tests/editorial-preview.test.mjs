// Browser smoke tests for the current production editor and generated galleries.
// The old /test/ exhibition was an experiment, not the released archive.
import {chromium,devices} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const root='http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
await mkdir('editorial-preview-results',{recursive:true});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext(mobile?{...devices['Pixel 7']}:{viewport:{width:1440,height:900}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    localStorage.setItem('algoart-intro-seen','1');
    localStorage.setItem('algoart-ethos-seen','1');
  });
  await page.goto(root,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#statsText')?.textContent?.includes(' · ')&&
    document.getElementById('creatingOverlay')?.hidden===true,null,{timeout:120000});
  const studio=await page.evaluate(()=>({
    width:document.documentElement.scrollWidth,viewport:innerWidth,
    title:document.querySelector('#welcomeLogo')?.textContent?.trim(),
    nav:document.querySelectorAll('.algo-site-nav a').length,
    controls:['seed','materialStyle','palette','colourCount','elements','density','complexity','negativeSpace','plotterPaper','plotterGrouping','orientation'].every(id=>!!document.getElementById(id)),
    dimensions:[document.querySelector('#art').width,document.querySelector('#art').height],
    inspector:!!document.querySelector('#inspector .tabs')
  }));
  assert.equal(studio.title,'PROPORTION PIECE');
  assert(studio.nav>=3&&studio.controls&&studio.inspector,'Studio must provide navigation and working controls');
  assert(studio.dimensions[0]>0&&studio.dimensions[1]>0,'Artwork canvas must render');
  assert(studio.width<=studio.viewport+2,'Studio horizontal overflow: '+JSON.stringify(studio));
  await page.evaluate(()=>{document.getElementById('introSplash').hidden=false;});
  const welcome=await page.evaluate(()=>({
    width:document.querySelector('.welcome-composition').scrollWidth,
    viewport:innerWidth,begin:!!document.getElementById('introEnter'),
    heading:document.getElementById('introTitle')?.textContent
  }));
  assert(welcome.width<=welcome.viewport+2&&welcome.begin&&welcome.heading==='PROPORTION PIECE',
    'Welcome panel must fit viewport and retain BEGIN');
  await page.screenshot({path:'editorial-preview-results/'+(mobile?'welcome-mobile':'welcome-desktop')+'.png'});
  await page.evaluate(()=>{document.getElementById('introSplash').hidden=true;});
  await page.screenshot({path:'editorial-preview-results/'+(mobile?'studio-mobile':'studio-desktop')+'.png'});
  await page.goto(root+'gallery/',{waitUntil:'domcontentloaded'});
  await page.locator('.day-card img').first().waitFor({state:'visible',timeout:30000});
  const archive=await page.evaluate(()=>({
    width:document.documentElement.scrollWidth,viewport:innerWidth,
    count:document.querySelectorAll('.day-card').length,
    covers:[...document.querySelectorAll('.day-card img')].map(img=>({
      src:img.getAttribute('src'),fallback:img.getAttribute('onerror')
    })),
    links:[...document.querySelectorAll('.day-card a')].map(a=>a.getAttribute('href'))
  }));
  assert(archive.count>=16,'Daily archive must contain published editions');
  assert(archive.covers.length===archive.count,'Every edition needs a preview image');
  assert(archive.covers.every(img=>img.src?.includes('archive-preview.jpg')||img.fallback?.includes('this.src=')),
    'Archive covers must use a prebuilt preview or an explicit fallback');
  assert(archive.links.every(x=>/(?:^|\/)\d{4}-\d\d-\d\d\/$/.test(x)),
    'Every daily edition must link to its own published day');
  assert(archive.width<=archive.viewport+2,'Daily archive horizontal overflow');
  await page.screenshot({path:'editorial-preview-results/'+(mobile?'archive-mobile':'archive-desktop')+'.png',fullPage:true});
  await page.goto(root+'gallery/2026-10-17/',{waitUntil:'domcontentloaded'});
  const day=await page.evaluate(()=>({
    css:[...document.querySelectorAll('link[rel="stylesheet"]')].some(x=>x.href.includes('editorial.css')),
    works:document.querySelectorAll('.art-card').length,
    remix:document.querySelectorAll('.art-card .remix').length,
    width:document.documentElement.scrollWidth,viewport:innerWidth
  }));
  assert(day.css&&day.works===16&&day.remix===day.works,
    'Existing October 17 archive must retain its 16 artworks and replay links');
  assert(day.width<=day.viewport+2,'Historical gallery horizontal overflow');
  await page.screenshot({path:'editorial-preview-results/'+(mobile?'day-mobile':'day-desktop')+'.png',fullPage:true});
  assert.deepEqual(errors,[],'No uncaught page exceptions during studio/gallery checks');
  console.log(mobile?'PASS mobile editorial gallery':'PASS desktop editorial gallery');
  await context.close();
 }
}finally{await browser.close()}
