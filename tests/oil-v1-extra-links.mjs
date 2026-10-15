// Oil v1 additional editor links: source 4-Up, φ framing, SVG and plotter.
// These actions must work despite Oil's separate material renderer.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1530,height:970},acceptDownloads:true});
page.setDefaultTimeout(90000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(root+'?v=9&seed=V5Q-OIL-D7ADDCCC68&mode=spiral&material=oil-v1',
   {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#statsText')?.
   textContent.includes('OIL PAINT'));
 const starting=await page.evaluate(()=>({
   material:document.querySelector('#materialStyle').value,
   sourceMeta:window.AlgoArt.lastRenderMeta?.guide?.type
 }));
 assert.equal(starting.material,'oil');
 assert.equal(starting.sourceMeta,'spiral');
 await page.locator('#variations').click();
 await page.waitForFunction(()=>document.querySelector('#variationsOverlay')?.hidden===false);
 const cards=await page.evaluate(()=>[...document.querySelectorAll('.variation-card')].map(c=>({
    seed:c.dataset.seed,canvas:[c.querySelector('canvas')?.width,
      c.querySelector('canvas')?.height]})));
 assert.equal(cards.length,4,'Expected four Oil preview variants');
 for(const card of cards){
   assert(card.seed,'Missing actual Oil variation seed');
   assert(card.canvas[0]>100&&card.canvas[1]>100,
     'Unpainted Oil 4-Up thumbnail');
 }
 await page.locator('#closeVariations').click();
 assert.equal(await page.locator('#materialStyle').inputValue(),'oil');
 assert.equal(await page.evaluate(()=>window.AlgoArt.lastRenderMeta?.guide?.type),
   'spiral','Oil 4-Up overwrote selected canvas guide metadata');

 await page.locator('#phiSheetFit').check();
 await page.waitForFunction(()=>document.querySelector('#phiSheetFit')?.checked);
 assert.match(page.url(),/sheet=phi/);
 assert.match(page.url(),/material=oil-v1/);
 assert.equal(await page.evaluate(()=>window.AlgoArt.lastRenderMeta?.guide?.type),
   'spiral','φ framed Oil lost original spiral metadata');
 const phiToggle=await page.evaluate(()=>({
    text:document.querySelector('#phiSheetInfo')?.textContent,
    material:document.querySelector('#materialStyle')?.value
 }));
 assert(phiToggle.text,'Missing φ framing message on Oil');
 assert.equal(phiToggle.material,'oil');

 await page.locator('#tab-export').click();
 const downloadPromise=page.waitForEvent('download',{timeout:45000});
 await page.locator('#saveSVG').click();
 const dl=await downloadPromise;
 assert.match(dl.suggestedFilename(),/\.svg$/i);
 // The SVG/plotter exports intentionally keep marker paths; they are not
 // literal Oil stroke raster-vectorisations.
 await page.locator('#previewPlotter').click();
 await page.waitForFunction(()=>document.querySelector('#plotterPreview')?.hidden===false,
  null,{timeout:60000});
 const plotter=await page.evaluate(()=>({
    summary:document.querySelector('#plotterSummary')?.textContent,
    preview:document.querySelector('#plotterPreviewImage')?.getAttribute('src'),
    material:document.querySelector('#materialStyle')?.value
 }));
 assert(plotter.summary,'Oil plotter preview produced no metadata');
 assert(plotter.preview?.startsWith('blob:'),'Oil plotter preview has no SVG image');
 assert.equal(plotter.material,'oil');
 assert.deepEqual(errors,[],'Oil secondary editor action raised a page error');
 console.log('PASS Oil v1 4-Up, original source metadata after preview, φ framing URL, source SVG download & plotter preview',
   JSON.stringify({cards,phiToggle,svg:dl.suggestedFilename(),plotter}));
}finally{await browser.close()}
