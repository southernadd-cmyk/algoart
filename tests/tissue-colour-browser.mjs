// Real-browser regression: Randomise never switches material.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1360,height:980}});
const errors=[];
page.on('pageerror',error=>errors.push(String(error.message)));
try{
  async function open(params){
    const url=new URL(root);
    url.searchParams.set('v','8');
    url.searchParams.set('seed','TISSUE-COLOUR-BROWSER');
    url.searchParams.set('mode','rects');
    url.searchParams.set('pal','neon');
    for(const [name,value] of Object.entries(params))url.searchParams.set(name,String(value));
    await page.goto(url.href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>Boolean(document.querySelector('#statsText')?.textContent));
  }
  await open({watercolor:1});
  assert.equal(await page.locator('#materialStyle').inputValue(),'tissue');
  assert.equal(await page.evaluate(()=>window.AlgoArt.lastOilMaterialStats?.tissuePaletteVersion),1,
    'Archived v1 URL must use original pigment version');
  await page.locator('#randomise').click();
  assert.equal(await page.locator('#materialStyle').inputValue(),'tissue');
  assert.equal(new URL(page.url()).searchParams.get('tissue'),'4');
  const initial=await page.evaluate(()=>window.AlgoArt.lastOilMaterialStats?.inkColours);
  assert(initial?.length>0,'New tissue should record a source palette');
  const firstURL=page.url();
  await page.locator('#randomise').click();
  assert.equal(await page.locator('#materialStyle').inputValue(),'tissue');
  const second=await page.evaluate(()=>window.AlgoArt.lastOilMaterialStats?.inkColours);
  assert.notEqual(page.url(),firstURL,'Randomise should change the composition');
  assert(second?.length>0);
  await page.locator('#materialStyle').selectOption('marker');
  await page.locator('#randomise').click();
  assert.equal(await page.locator('#materialStyle').inputValue(),'marker',
    'Marker must remain selected after Randomise');
  assert.equal(new URL(page.url()).searchParams.has('tissue'),false);
  await page.locator('#materialStyle').selectOption('tissue');
  assert.equal(await page.locator('#materialStyle').inputValue(),'tissue');
  assert.equal(new URL(page.url()).searchParams.get('tissue'),'4');
  await page.locator('#tab-colour').click();
  await page.locator('#palette').selectOption('mono');
  const mono=await page.evaluate(()=>window.AlgoArt.lastOilMaterialStats?.inkColours);
  assert(mono?.length>0);
  assert(mono.every(c=>/^#([a-f0-9]{2})\1\1$/i.test(c)),
    'Changing Colour → Monochrome must give truly monochrome Tissue inks');
  await open({tissue:2,pal:'cold'});
  assert.equal(await page.evaluate(()=>window.AlgoArt.lastOilMaterialStats?.tissuePaletteVersion),2,
    'Existing tissue=2 share links must retain original output');
  await open({tissue:3,pal:'cold'});
  assert.equal(await page.evaluate(()=>window.AlgoArt.lastOilMaterialStats?.tissuePaletteVersion),3,
    'Existing tissue=3 share links should retain their original material');
  await open({tissue:4,pal:'cold'});
  assert.equal(await page.locator('#materialStyle').inputValue(),'tissue');
  assert.equal(await page.evaluate(()=>window.AlgoArt.lastOilMaterialStats?.tissuePaletteVersion),4);
  assert((await page.evaluate(()=>window.AlgoArt.lastOilMaterialStats?.graphitePaths))>0);
  assert((await page.evaluate(()=>window.AlgoArt.lastOilMaterialStats?.graphiteHatchPaths))>25);
  await page.locator('#art').screenshot({path:'oil-check-results/tissue-seeded-cold.png'});
  await open({tissue:4,pal:'warm'});
  await page.locator('#art').screenshot({path:'oil-check-results/tissue-seeded-warm.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS: Randomise preserves Marker or Tissue selection');
  console.log('PASS: historic watercolour URL stays v1 until randomised');
  console.log('PASS: Tissue follows Colour controls and versioned share URLs');
}finally{await browser.close()}
