// Oil Paint v1 public-release browser regression.
// Fail closed: Oil-only routing, usable UI and download, unchanged originals.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1450,height:960}});
 await page.addInitScript(()=>localStorage.setItem('algoart-inspector-desktop','open'));
 page.setDefaultTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'?v=9&seed=V5Q-OIL-D7ADDCCC68&mode=spiral&material=oil-v1',
   {waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>/oil/i.test(document.querySelector('#statsText')?.textContent||''),null,{timeout:90000});
 const result=await page.evaluate(async()=>{
  const A=window.AlgoArt,sel=document.querySelector('#materialStyle');
  const nativeSeed=A.readSettings();
  const s={...nativeSeed,mode:'spiral',orientation:'portrait',
    seed:'V5Q-OIL-D7ADDCCC68',palette:'earth',
    density:67,elements:48,complexity:65,negativeSpace:52};
  const make=fn=>{
    const canvas=document.createElement('canvas'),stats=fn(canvas);
    return {png:canvas.toDataURL('image/png'),canvas,stats};
  };
  const markerBefore=make(c=>A.render(c,s,.18,false));
  const tissueBefore=make(c=>A.renderOil(c,s,.18,false,7));
  const waterBefore=make(c=>A.renderWatercolourV2S(c,s,.18,false));
  const oil=make(c=>A.renderOilPaintV1(c,s,.18,false));
  const oilAgain=make(c=>A.renderOilPaintV1(c,s,.18,false));
  const markerAfter=make(c=>A.render(c,s,.18,false));
  const tissueAfter=make(c=>A.renderOil(c,s,.18,false,7));
  const waterAfter=make(c=>A.renderWatercolourV2S(c,s,.18,false));
  const settings=A.readSettings();
  const png=await A.preparePNG({...settings,oilPaintRender:true,
    oilRender:false,watercolourRender:false},1);
  const stats={
    currentMaterial:sel.value,currentUrl:location.search,
    currentDescription:document.querySelector('#descriptionAlt')?.textContent,
    currentNote:document.querySelector('#materialStyleNote')?.textContent,
    oilVersion:oil.stats.version,
    oilBroad:oil.stats.work.oilV1.broadFields,
    oilContacts:oil.stats.work.oilV1.materialContacts,
    oilDimensions:[oil.canvas.width,oil.canvas.height],
    oilDeterministic:oil.png===oilAgain.png,
    markerUnchanged:markerBefore.png===markerAfter.png,
    waterUnchanged:waterBefore.png===waterAfter.png,
    tissueUnchanged:tissueBefore.png===tissueAfter.png,
    pngFilename:png.filename,pngBytes:png.blob.size,
    defaultOilRoute:typeof A.renderOilPaintV1==='function'
  };
  return stats;
 });
 assert.equal(result.currentMaterial,'oil');
 assert.match(result.currentUrl,/material=oil-v1/);
 assert.match(result.currentDescription,/oil painting/i);
 assert.match(result.currentNote,/Oil Paint — thick brushstrokes, visible bristle marks and colour built up in layers/);
 assert.equal(result.oilVersion,'oil-paint-v1');
 assert(result.oilBroad>=1,'No source connections on selected oil test seed');
 assert(result.oilContacts>=4,'No actual V4e oil-bristle contact pass');
 assert.deepEqual(result.oilDimensions,[180,252]);
 assert.equal(result.oilDeterministic,true);
 assert.equal(result.markerUnchanged,true);
 assert.equal(result.tissueUnchanged,true);
 assert.equal(result.waterUnchanged,true);
 assert.match(result.pngFilename,/-oil-paint-v1-1x\.png$/);
 assert(result.pngBytes>50000,'PNG export path did not paint actual Oil image');
 await page.goto(root+'?v=9&seed=V5Q-TISSUE-147B0C7675&mode=organic&tissue=7',
   {waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>document.querySelector('#materialStyle')?.value==='tissue',
  null,{timeout:90000});
 assert.equal(await page.locator('#materialStyle').inputValue(),'tissue',
   'Existing Tissue share links must remain Tissue');
 await page.goto(root+'?v=9&seed=V5Q-OIL-D7ADDCCC68&mode=spiral&material=watercolour-v2s',
   {waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>document.querySelector('#materialStyle')?.value==='watercolour',
   null,{timeout:90000});
 assert.equal(await page.locator('#materialStyle').inputValue(),'watercolour');
 assert.deepEqual(errors,[],'Browser script exceptions in full UI');
 console.log('PASS: Oil Paint v1 selector, source-linked bristles, repeatability, PNG download and archived media unchanged',JSON.stringify(result));
}finally{await browser.close()}
