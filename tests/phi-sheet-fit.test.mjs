// Shared φ fit: first prove the exact SAME source transform is used by
// Marker Canvas, archived SVG, Tissue V7 and Watercolour V2S, then preserve
// the original no-sheet render byte-for-byte.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1450,height:960}});
  page.setDefaultTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=new URL(base);
  url.search='?v=9&seed=PHI-SHEET-20261014&mode=field&pal=neon&material=watercolour-v2s&fit=0';
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#statsText')?.textContent.includes('PHI-SHEET'));
  assert.equal(await page.locator('#phiSheetFit').isChecked(),false);
  await page.locator('#phiSheetFit').check();
  assert.equal(new URL(page.url()).searchParams.get('sheet'),'phi');
  assert.match(await page.locator('#phiSheetInfo').textContent(),/Applied/);
  const first=await page.evaluate(()=>{
    const A=window.AlgoArt,s=A.readSettings();
    function marker(fit){
      A.phiFramingEnabled=fit;
      const recorder={precise:true,paths:[],paperMarks:[]},prior=A.svgRecorder;
      const c=document.createElement('canvas');
      A.svgRecorder=recorder;
      try{
        A.render(c,s,.3,false);
        return {png:c.toDataURL('image/png'),
          paths:recorder.paths,
          meta:JSON.parse(JSON.stringify(A.lastRenderMeta)),
          fit:JSON.parse(JSON.stringify(A.lastPhiSheetFrame))};
      }finally{A.svgRecorder=prior;}
    }
    const source=marker(false);
    const adapted=marker(true),repeat=marker(false);
    A.phiFramingEnabled=true;
    const tissue=document.createElement('canvas');
    A.renderOil(tissue,s,.23,false,7);
    const tissueMeta=JSON.parse(JSON.stringify(A.lastRenderMeta));
    A.watercolourV2sOptions.fitToSheet=false;
    const water=document.createElement('canvas');
    A.renderWatercolourV2S(water,s,.23,false);
    const paintStats=JSON.parse(JSON.stringify(A.lastWatercolourExperimentStats));
    const paintMeta=JSON.parse(JSON.stringify(A.lastRenderMeta));
    return {source,adapted,byteStable:source.png===repeat.png,
      tissueMeta,paintStats,paintMeta};
  });
  assert(first.byteStable,'Original Marker drawing changed after toggling φ fit');
  assert.notEqual(first.source.png,first.adapted.png,'φ framing must visibly differ');
  const plan=first.adapted.fit;
  assert.equal(plan.kind,'phi-sheet');
  assert(plan.scale>0.61&&plan.scale<1.62);
  assert(Math.abs(plan.targetCover-(Math.sqrt(5)-1)/2)<1e-12);
  assert.equal(first.adapted.paths.length,first.source.paths.length);
  const expected=await page.evaluate(input=>
    window.AlgoArt.phiSheetFit.svgPath(input.path,input.fit),
    {path:first.source.paths[0].d,fit:plan});
  assert.equal(first.adapted.paths[0].d,expected,'SVG and canvas paths differ');
  assert(Math.abs(first.adapted.paths[0].width-
      first.source.paths[0].width*plan.scale)<1e-6);
  assert.equal(first.tissueMeta.phiSheetFrame.kind,'phi-sheet');
  assert.equal(first.paintMeta.phiSheetFrame.kind,'phi-sheet');
  assert.equal(first.paintStats.compositionPresentation.kind,'source-exact',
    'Watercolour must not apply two independent fitting transforms');
  assert(Math.abs(first.paintMeta.phiSheetFrame.scale-plan.scale)<1e-9,
    'Tissue and Watercolour must share exact geometric fit with Marker');
  assert.equal(first.adapted.meta.voids.length,first.source.meta.voids.length);
  assert.equal(new URL(page.url()).searchParams.get('fit'),'0');
  // Sidebar should keep the option when material changes; no retroactive
  // upgrade to historical V2R or Tissue revision share links.
  await page.locator('#materialStyle').selectOption('marker');
  assert.equal(await page.locator('#phiSheetFit').isChecked(),true);
  assert.equal(new URL(page.url()).searchParams.get('sheet'),'phi');
  await page.locator('#materialStyle').selectOption('tissue');
  assert.equal(await page.locator('#phiSheetFit').isChecked(),true);
  assert.equal(new URL(page.url()).searchParams.get('tissue'),'7');
  await page.locator('#phiSheetFit').uncheck();
  assert.equal(new URL(page.url()).searchParams.has('sheet'),false);
  await page.goto(new URL('?v=9&seed=PHI-SHEET-20261014&mode=field&pal=neon&material=watercolour-v2s&fit=1',base).href);
  await page.waitForFunction(()=>document.querySelector('#statsText')?.textContent.includes('PHI-SHEET'));
  assert.equal(await page.locator('#phiSheetFit').isChecked(),false);
  assert.equal(await page.locator('#watercolourFit').isChecked(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS shared φ framing: source Marker and SVG path identity, Watercolour/Tissue parity, no double-fit, legacy links, deterministic no-sheet');
}finally{await browser.close();}
