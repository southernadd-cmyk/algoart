// Mobile WebView-sized downloads and true (not merely selected) cream paper.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out=path.resolve('oil-check-results');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  viewport:{width:390,height:844},screen:{width:390,height:844},
  isMobile:true,hasTouch:true,deviceScaleFactor:2,acceptDownloads:true
});
await context.addInitScript(()=>{localStorage.setItem('algoart-intro-seen','1');localStorage.setItem('algoart-ethos-seen','1')});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
async function load(material,fmt='landscape'){
  const u=new URL(root);
  u.searchParams.set('v','8');u.searchParams.set('seed','MOBILE-CREAM-20261014');
  u.searchParams.set('mode','rects');u.searchParams.set('pal','golden');
  u.searchParams.set('paper','#f5f0e6');
  if(fmt==='portrait')u.searchParams.set('fmt','portrait');
  if(material==='tissue')u.searchParams.set('tissue','2');
  await page.goto(u.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#art')?.width>0);
}
async function openExport(){
  if(await page.locator('#inspectorToggle').isVisible())await page.locator('#inspectorToggle').click();
  await page.locator('#tab-export').click();
  await page.locator('#savePanel').waitFor({state:'visible'});
}
async function checkDownload(button,extension,name){
  const [download]=await Promise.all([
    page.waitForEvent('download',{timeout:90000}),
    page.locator(button).click()
  ]);
  const filename=download.suggestedFilename();
  assert(filename.endsWith(extension),'Wrong download name: '+filename);
  const dest=path.join(out,name+extension);
  await download.saveAs(dest);
  const contents=await fs.readFile(dest);
  assert(contents.length>5000,'File too small: '+contents.length);
  if(extension==='.png'){
    assert.equal(contents.subarray(1,4).toString(),'PNG');
    const width=contents.readUInt32BE(16),height=contents.readUInt32BE(20);
    assert.deepEqual([width,height],name.includes('portrait')?[1000,1400]:[1400,1000]);
  }
  return {filename,size:contents.length};
}
try{
  await load('tissue');
  assert.equal(await page.locator('#materialStyle').inputValue(),'tissue');
  // The old lighting would clip the cream foreground to (255,255,255).
  // Test *actual canvas pixels* in several paper-reserve corner regions.
  const paper=await page.evaluate(()=>{
    const c=document.querySelector('#art'),ctx=c.getContext('2d');
    const samples=[];
    for(const [x,y] of [[8,8],[18,18],[35,20],[c.width-8,8],
      [c.width-24,26],[8,c.height-8],[22,c.height-29],
      [c.width-8,c.height-8],[c.width-30,c.height-25]]){
      const pixel=Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3);
      samples.push(pixel);
    }
    return samples;
  });
  const reference=[245,240,230];
  const distances=paper.map(p=>p.map((v,i)=>Math.abs(v-reference[i])));
  assert(distances.filter(d=>d.every(v=>v<=13)).length>=5,
    'Tissue paper is washed out or not cream: '+JSON.stringify(paper));
  assert(paper.filter(p=>p.every(v=>v>=253)).length<=1,
    'Tissue paper must not clip to pure white: '+JSON.stringify(paper));
  await page.locator('#art').screenshot({path:path.join(out,'tissue-cream-paper.png')});
  await openExport();
  assert.equal(await page.locator('#exportScale').inputValue(),'1',
    'Mobile must default to a memory-safe PNG scale');
  assert.equal(await page.locator('#exportScale option[value="3"]').isDisabled(),true,
    '3x render should not be available on low-memory mobile');
  const png=await checkDownload('#savePanel','.png','tissue-mobile-landscape');
  assert.match(await page.locator('#exportStatus').textContent(),/download started/i);
  const svg=await checkDownload('#saveSVG','.svg','tissue-mobile-svg');
  console.log('PASS Tissue mobile 1x PNG and SVG downloads',png,svg);
  await load('marker','portrait');
  await openExport();
  assert.equal(await page.locator('#exportScale').inputValue(),'1');
  const marker=await checkDownload('#savePanel','.png','marker-mobile-portrait');
  assert.equal(await page.locator('#materialStyle').inputValue(),'marker');
  console.log('PASS Marker mobile portrait download',marker);
  assert.deepEqual(errors,[],'Unexpected browser errors');
  console.log('PASS exact cream reserve pixels on actual 14 October Tissue material');
}finally{await browser.close()}
