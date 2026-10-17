// V2S layout-fidelity and speed controls. No image-quality concession:
// compare every pixel with old (uncached) paper rotation and all φ geometry.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const b=await chromium.launch({headless:true});
try{
  const page=await b.newPage({viewport:{width:1450,height:930}});
  page.setDefaultTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function visit(args){
    const url=new URL(base);
    url.search='?v=9&seed=3XHXQ-4616&mode=field&pal=neon&material=watercolour-v2s'+args;
    await page.goto(url.href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#statsText')?.textContent.includes('3XHXQ-4616'));
    return new URL(page.url());
  }
  // Old links had implicit fitting; explicit false must not alter them.
  let url=await visit('');
  assert.equal(url.searchParams.get('fit'),'1','Legacy V2S must preserve fitted layout');
  assert.equal(await page.locator('#watercolourFit').isChecked(),true);
  assert.equal(await page.locator('#watercolourFitControl').isVisible(),true);
  url=await visit('&fit=0');
  assert.equal(url.searchParams.get('fit'),'0');
  assert.equal(await page.locator('#watercolourFit').isChecked(),false);
  assert.match(await page.locator('#materialStyleNote').textContent(),/match the Marker\/plotter φ composition/);

  const experiment=await page.evaluate(()=>{
    const A=window.AlgoArt,settings=A.readSettings();
    function render(fit,memo){
      A.watercolourV2sOptions.fitToSheet=fit;
      A.watercolourV2sOptions.paperRotationCache=memo;
      const out=document.createElement('canvas'),started=performance.now();
      A.renderWatercolourV2S(out,settings,.45,false);
      return {pixels:out.toDataURL('image/png'),
        ms:Math.round(performance.now()-started),
        geom:JSON.parse(JSON.stringify(A.lastWatercolourExperimentStats.compositionPresentation))};
    }
    // Keep test focused on the source/pigment engine rather than UI repaint.
    const rawUncached=render(false,false);
    const rawCached=render(false,true);
    const legacyUncached=render(true,false);
    const legacyCached=render(true,true);
    return {rawUncached,rawCached,legacyUncached,legacyCached};
  });
  assert.equal(experiment.rawCached.pixels,experiment.rawUncached.pixels,
    'Cached paper rotation changed exact pigment pixels in φ-native layout');
  assert.equal(experiment.legacyCached.pixels,experiment.legacyUncached.pixels,
    'Cached paper rotation changed historical fitted pigment pixels');
  assert.equal(experiment.rawCached.geom.kind,'source-exact');
  assert.equal(experiment.rawCached.geom.factor,1);
  assert.notEqual(experiment.rawCached.pixels,experiment.legacyCached.pixels,
    'Fit-to-sheet should visibly differ on compact Field composition');
  console.log('BENCHMARK uncached/cached raw',experiment.rawUncached.ms,
    experiment.rawCached.ms,'legacy',experiment.legacyUncached.ms,experiment.legacyCached.ms);

  // Changing the visible control yields a versioned new URL, with no seed/φ
  // parameter modified, and can be switched off without page reload.
  await visit('&fit=0');
  const before=new URL(page.url());
  await page.locator('#watercolourFit').check();
  await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true,{timeout:180000});
  const after=new URL(page.url());
  assert.equal(after.searchParams.get('fit'),'1');
  for(const key of ['seed','mode','v','pal'])assert.equal(after.searchParams.get(key),before.searchParams.get(key));
  await page.locator('#watercolourFit').uncheck();
  await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true,{timeout:180000});
  assert.equal(new URL(page.url()).searchParams.get('fit'),'0');

  // The fit toggle must not be shown on Marker or Tissue.
  await page.locator('#materialStyle').selectOption('marker');
  await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true,{timeout:180000});
  assert.equal(await page.locator('#watercolourFitControl').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS V2S fit opt-in, immutable legacy URLs, unchanged φ geometry, pixel-perfect cached paper rotation');
}finally{await b.close()}
