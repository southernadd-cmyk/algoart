// Release integration: Watercolour V2R must be a genuinely third material,
// preserving historical Tissue links, source settings, URL replay and PNG export.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1200,height:850},acceptDownloads:true});
await context.addInitScript(()=>{
  localStorage.setItem('algoart-intro-seen','1');
  localStorage.setItem('algoart-ethos-seen','1');
});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
async function stable(){
  await page.waitForFunction(()=>document.querySelector('#statsText')?.textContent.includes('WC-RELEASE-V2R-001'),
    null,{timeout:180000});
}
try{
  const url=new URL(root);
  url.search='?v=9&seed=WC-RELEASE-V2R-001&mode=rects&pen=highlighter&paper=%23d9c7b9';
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await stable();
  const original=await page.evaluate(()=>({
    settings:window.AlgoArt.readSettings(),
    rendererVersion:window.AlgoArt.rendererVersion,
    savedMaterial:window.AlgoArt.oilMaterial,
    sourceFn:window.AlgoArt.renderOil instanceof Function,
    waterFn:window.AlgoArt.renderWatercolourV2R instanceof Function
  }));
  assert(original.sourceFn&&original.waterFn);
  assert.equal(original.rendererVersion,9);
  assert.equal(await page.locator('#materialStyle').inputValue(),'marker');

  await page.locator('#materialStyle').selectOption('tissue');
  assert.equal(new URL(page.url()).searchParams.get('tissue'),'6');
  const tissueSnapshot=await page.evaluate(()=>{
    const A=window.AlgoArt,settings=A.readSettings(),output=document.createElement('canvas');
    A.renderOil(output,settings,.34,false,6);
    return output.toDataURL('image/png');
  });

  await page.locator('#materialStyle').selectOption('watercolour');
  assert.equal(new URL(page.url()).searchParams.get('material'),'watercolour-v2r');
  assert.equal(new URL(page.url()).searchParams.has('tissue'),false);
  assert.equal(new URL(page.url()).searchParams.get('paper'),'#d9c7b9');
  assert.match(await page.locator('#materialStyleNote').textContent(),/Watercolour pigments/);
  assert.match(await page.locator('#statsText').textContent(),/WATERCOLOUR/);
  const water=await page.evaluate(()=>{
    const A=window.AlgoArt,settings=A.readSettings(),savedMaterial=A.oilMaterial;
    const a=document.createElement('canvas'),b=document.createElement('canvas');
    A.renderWatercolourV2R(a,settings,.34,false);
    const stats=A.lastWatercolourExperimentStats;
    A.renderWatercolourV2R(b,settings,.34,false);
    const same=a.toDataURL('image/png')===b.toDataURL('image/png');
    const restored=A.oilMaterial===savedMaterial;
    return {settings,version:A.rendererVersion,same,restored,stats,
      pngBytes:a.toDataURL('image/png').length};
  });
  assert.deepEqual(water.settings,original.settings,'Material changes source composition');
  assert.equal(water.version,9);
  assert(water.same,'Watercolour not deterministic');
  assert(water.restored,'Original renderer must be restored after Watercolour');
  assert(water.pngBytes>20000,'Watercolour render blank');
  assert.equal(water.stats.paper,'#d9c7b9','Material must respect selected paper');
  assert(water.stats.dryMedia.continuousDryStrokes>0,'Dry brush not used');
  assert(water.stats.paperFlow.wetMaskPixels>0);
  assert(water.stats.paperFlow.conservationError<.00002);
  assert.match(await page.locator('#materialControlsNote').textContent(),/Watercolour PNGs/);

  // Actual desktop download, not just a successful Canvas render.
  await page.locator('#tab-export').click();
  const [download]=await Promise.all([
    page.waitForEvent('download',{timeout:180000}),
    page.locator('#savePanel').click()
  ]);
  assert.match(download.suggestedFilename(),/-watercolour-v2r-1x\.png$/);
  const stream=await download.createReadStream();
  let size=0;for await (const chunk of stream)size+=chunk.length;
  assert(size>20000,'Export file is blank');
  await page.locator('#tab-composition').click();

  await page.locator('#materialStyle').selectOption('tissue');
  assert.equal(new URL(page.url()).searchParams.get('material'),null);
  const tissueReplay=await page.evaluate(()=>{
    const A=window.AlgoArt,output=document.createElement('canvas');
    A.renderOil(output,A.readSettings(),.34,false,6);
    return output.toDataURL('image/png');
  });
  assert.equal(tissueReplay,tissueSnapshot,'Historical Tissue V6 pixels changed');
  await page.locator('#materialStyle').selectOption('marker');
  assert.equal(new URL(page.url()).searchParams.has('material'),false);
  assert.equal(new URL(page.url()).searchParams.has('tissue'),false);

  // A new share URL reopens the selected watercolour and the same controls.
  await page.locator('#materialStyle').selectOption('watercolour');
  const shared=page.url();
  await page.goto(shared,{waitUntil:'domcontentloaded'});await stable();
  assert.equal(await page.locator('#materialStyle').inputValue(),'watercolour');
  assert.deepEqual(await page.evaluate(()=>window.AlgoArt.readSettings()),original.settings);
  assert.equal(await page.evaluate(()=>window.AlgoArt.rendererVersion),9);

  // Randomise keeps the material, the chosen paper, and the serialized type.
  await page.locator('#randomise').click();
  assert.equal(await page.locator('#materialStyle').inputValue(),'watercolour');
  assert.equal(new URL(page.url()).searchParams.get('material'),'watercolour-v2r');
  assert.equal(new URL(page.url()).searchParams.get('paper'),'#d9c7b9');
  assert.deepEqual(errors,[]);
  console.log('PASS watercolour material URL, old Tissue pixel identity, determinism, renderer restoration, user paper, PNG download, randomise',size);
}finally{await browser.close()}
