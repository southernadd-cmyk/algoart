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
  if(material==='tissue')u.searchParams.set('tissue','4');
  await page.goto(u.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#art')?.width>0);
}
async function openExport(){
  if(await page.locator('#app').evaluate(el=>el.classList.contains('inspector-closed')))await page.locator('#inspectorToggle').click();
  await page.locator('#tab-export').click();
  await page.locator('#savePanel').waitFor({state:'visible'});
}
async function changeArtwork(){
  // The drawer covers stage actions on small screens. Close it before changing a drawing.
  if(!await page.locator('#app').evaluate(el=>el.classList.contains('inspector-closed')))
    await page.locator('#inspectorClose').click();
  await page.locator('#randomise').click();
  await openExport();
}
async function checkDownload(button,extension,name){
  if(button==='#savePanel'){
    await page.locator(button).tap();
    await page.locator('#pngDownload').waitFor({state:'visible'});
    button='#pngDownload';
  }
  const [download]=await Promise.all([
    page.waitForEvent('download',{timeout:90000}),
    page.locator(button).click()
  ]);
  const filename=download.suggestedFilename();
  assert(filename.endsWith(extension),'Wrong download name: '+filename);
  const dest=path.join(out,name+extension);
  await download.saveAs(dest);
  const contents=await fs.readFile(dest);
  // A valid sparse SVG/plotter export can be well below 5 KB.
  // PNG stays size-guarded; SVG must contain real vector drawing instructions.
  if(extension==='.png')assert(contents.length>5000,'PNG too small: '+contents.length);
  if(extension==='.svg'){
    const xml=contents.toString('utf8');
    assert.match(xml,/<svg\b[^>]*>/i,'SVG document missing root');
    assert.match(xml,/<\/svg>\s*$/i,'SVG document incomplete');
    assert.match(xml,/<(?:path|line|polyline|polygon|rect|circle|ellipse)\b/i,
      'SVG contains no drawable geometry');
  }
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
  assert.equal(await page.evaluate(()=>window.AlgoArt.lastOilMaterialStats?.graphitePaths),0,
    'Original V1 graphite must not gain extra contour overlays');
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
  // Broad pigment washes may colour some corners (the point of this
  // material); what must stay visible is *cream* unpainted paper, never white.
  assert(distances.some(d=>d.every(v=>v<=13)),
    'No true cream reserve is visible: '+JSON.stringify(paper));
  assert(paper.filter(p=>p.every(v=>v>=250)).length<=1,
    'Tissue paper must not clip to white: '+JSON.stringify(paper));
  // A corner may contain a legitimate seeded wash. Measure paper separately
  // with no pigment chains so changing paint hues cannot invalidate this test.
  const reserves=await page.evaluate(()=>{
    const A=window.AlgoArt,settings=A.readSettings();
    return ['PAPER-A','PAPER-B'].map(seed=>{
      const s={...settings,seed,paper:'#123456'};
      const kit=A.tissueKitFromPaths([],s,4);
      const c=document.createElement('canvas');c.width=300;c.height=200;
      const ctx=c.getContext('2d');
      A.oilMaterial(ctx,300,200,[],{},seed,1,kit);
      return {paper:kit.paper,samples:[[20,20],[150,100],[280,180]].map(([x,y])=>
        Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3))};
    });
  });
  for(const reserve of reserves){
    assert.equal(reserve.paper,'#f5f0e6','Seed/custom colour must not change paper');
    assert(reserve.samples.every(p=>p.every((v,i)=>Math.abs(v-reference[i])<=5)),
      'Bare paper must remain default cream with subtle grain: '+JSON.stringify(reserve));
  }
  await page.locator('#art').screenshot({path:path.join(out,'tissue-cream-paper.png')});
  await openExport();
  assert.equal(await page.locator('#exportScale').inputValue(),'1',
    'Mobile must default to a memory-safe PNG scale');
  assert.equal(await page.locator('#exportScale option[value="3"]').isDisabled(),true,
    '3x render should not be available on low-memory mobile');
  // Regression for Android needing a full reload between exports: repeat the
  // *same material, same filename, same tab* without any navigation.
  const png=await checkDownload('#savePanel','.png','tissue-mobile-landscape');
  assert.match(await page.locator('#exportStatus').textContent(),/PNG ready/i);
  await page.locator('#savePanel').waitFor({state:'visible'});
  const secondPng=await checkDownload('#savePanel','.png','tissue-mobile-landscape-repeat');
  assert.equal(secondPng.filename.replace(/-2(?=\.png$)/,''),png.filename,
    'Repeat PNG should retain the artwork name with only a duplicate suffix');
  // Exact Android failure report: PNG -> Randomise -> PNG again, no reload.
  const oldSeed=await page.locator('#seed').inputValue();
  await changeArtwork();
  const newSeed=await page.locator('#seed').inputValue();
  assert.notEqual(newSeed,oldSeed,'Randomise must change the composition');
  assert.equal(await page.locator('#materialStyle').inputValue(),'tissue',
    'Randomise must retain Tissue material');
  const afterRandomise=await checkDownload('#savePanel','.png','tissue-mobile-after-randomise');
  assert(afterRandomise.filename.includes(newSeed),
    'Second PNG should encode the randomised composition instead of the old seed');
  assert.match(await page.locator('#exportStatus').textContent(),/PNG ready/i);
  // And again without refreshing or returning to the home screen.
  await changeArtwork();
  const newerSeed=await page.locator('#seed').inputValue();
  assert.notEqual(newerSeed,newSeed);
  const thirdSeed=await checkDownload('#savePanel','.png','tissue-mobile-after-second-randomise');
  assert(thirdSeed.filename.includes(newerSeed));
  const svg=await checkDownload('#saveSVG','.svg','tissue-mobile-svg');
  const secondSvg=await checkDownload('#saveSVG','.svg','tissue-mobile-svg-repeat');
  assert.match(secondSvg.filename,/(?:-2| \(2\))\.svg$/);
  const plotter=await checkDownload('#savePlotter','.svg','tissue-mobile-plotter');
  const secondPlotter=await checkDownload('#savePlotter','.svg','tissue-mobile-plotter-repeat');
  assert.match(secondPlotter.filename,/(?:-2| \(2\))\.svg$/);
  const thirdPng=await checkDownload('#savePanel','.png','tissue-mobile-landscape-third');
  assert.equal(thirdPng.filename.replace(/-\d+(?=\.png$)/,''),thirdSeed.filename.replace(/-\d+(?=\.png$)/,''),
    'Later PNG should preserve the same artwork identity');
  const liveDownloadLinks=await page.locator('a[download]').count();
  assert(liveDownloadLinks>=5,'Mobile download anchors must remain attached for browser consumption');
  console.log('PASS Tissue mobile repeated PNG, SVG and plotter downloads without reload',
    png,secondPng,svg,secondSvg,plotter,secondPlotter,thirdPng);
  await load('marker','portrait');
  await openExport();
  assert.equal(await page.locator('#exportScale').inputValue(),'1');
  const marker=await checkDownload('#savePanel','.png','marker-mobile-portrait');
  assert.equal(await page.locator('#materialStyle').inputValue(),'marker');
  console.log('PASS Marker mobile portrait download',marker);
  assert.deepEqual(errors,[],'Unexpected browser errors');
  console.log('PASS exact cream reserve pixels on actual 14 October Tissue material');
}finally{await browser.close()}
