// Experimental browser regression: captures actual V6 and watercolour Canvas2D
// outputs with identical V8 geometry, seed, orientation and palette.
// Run with local static server: python3 -m http.server 4173
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='watercolour-wet-edge-previews';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1580,height:1050}});
  const faults=[];
  page.on('pageerror',e=>faults.push(String(e.message)));
  // Non-tiled tooth regression: fixed-seed reproduction, another seed
  // produces a different sheet, and no tile-sized offset repeats the field.
  await page.goto(new URL('experiments/watercolour-wet-edge-preview.html',root).href,
    {waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>window.__previewReady===true||!!window.__previewError,
    null,{timeout:120000});
  const paper=await page.evaluate(()=>{
    const fn=window.AlgoArt.sampleWatercolourPaperTooth;
    const base=[],changedSeed=[],offsets=[64,128,256,512].map(()=>[]);
    for(let iy=0;iy<16;iy++)for(let ix=0;ix<16;ix++){
      const x=21+ix*19.73,y=31+iy*17.41;
      const a=fn('tooth-sheet-alpha',x,y);
      base.push(a);changedSeed.push(fn('tooth-sheet-beta',x,y));
      for(let j=0;j<offsets.length;j++)
        offsets[j].push(fn('tooth-sheet-alpha',x+[64,128,256,512][j],y));
    }
    const meanDiff=(other)=>base.reduce((sum,a,i)=>sum+Math.abs(a-other[i]),0)/base.length;
    return {same:fn('tooth-sheet-alpha',21,31)===base[0],
      distinct:meanDiff(changedSeed),
      translations:offsets.map(meanDiff),
      range:[Math.min(...base),Math.max(...base)]};
  });
  assert(paper.same,'Same seed/coordinates must replay pixel-exact tooth');
  assert(paper.distinct>.018,'Different seeds should give different paper');
  for(const delta of paper.translations)
    assert(delta>.018,'Paper repeats too closely at a regular tile offset: '+delta);
  assert(paper.range[1]-paper.range[0]>.06,'Paper tooth should be visibly non-flat');
  console.log('PASS non-tiling deterministic paper field',JSON.stringify(paper));
  for(let i=0;i<4;i++){
    const url=new URL('experiments/watercolour-wet-edge-preview.html',root);
    url.searchParams.set('case',String(i));
    await page.goto(url.href,{waitUntil:'load',timeout:60000});
    await page.locator('#preset').selectOption(String(i));
    await page.waitForFunction(()=>window.__previewReady===true||!!window.__previewError,
      null,{timeout:120000});
    const result=await page.evaluate(()=>{
      const A=window.AlgoArt,left=document.querySelector('#reference'),
        right=document.querySelector('#experimental');
      const original=A.oilMaterial;
      const paperFlow=A.lastWatercolourExperimentStats?.paperFlow;
      const tissueBefore=left.toDataURL('image/png');
      const experimentalBefore=right.toDataURL('image/png');
      // A true post-experiment V6 replay must be pixel-identical,
      // proving that the old mode remains untouched even in this page.
      const check=document.createElement('canvas');
      A.renderOil(check,window.__currentPreviewSettings,
        window.__currentPreviewScale,false,6);
      const restoredV6=check.toDataURL('image/png')===tissueBefore;
      // Repeat watercolour with the same original settings/seed to verify
      // paper absorption, fibre drift and blooms never depend on time.
      const wetReplay=document.createElement('canvas');
      let repeatWet=false;
      try{
        A.oilMaterial=A.watercolourMaterialExperiment;
        A.renderOil(wetReplay,window.__currentPreviewSettings,
          window.__currentPreviewScale,false,6);
        repeatWet=wetReplay.toDataURL('image/png')===experimentalBefore;
      }finally{A.oilMaterial=original;}
      const now={sameIdentity:typeof original==='function',
        wetMaterialIndependent:original!==A.watercolourMaterialExperiment,
        restoredV6,repeatWet,paperFlow,
        washStates:A.lastWatercolourExperimentStats?.washStates,
        dryDetails:A.lastWatercolourExperimentStats?.dryDetails,
        widthCaps:A.lastWatercolourExperimentStats?.widthCaps,
        washWidths:A.lastWatercolourExperimentStats?.washWidths,
        filledPools:A.lastWatercolourExperimentStats?.filledPools,
        mixedPigmentPools:A.lastWatercolourExperimentStats?.mixedPigmentPools,
        microBleedCount:A.lastWatercolourExperimentStats?.microBleedCount,
        microBleedWashCount:A.lastWatercolourExperimentStats?.microBleedWashCount,
        watercolorThinStrokeCount:A.lastWatercolourExperimentStats?.watercolorThinStrokeCount,
        dryThinStrokeCount:A.lastWatercolourExperimentStats?.dryThinStrokeCount,
        edgeDarkening:A.lastWatercolourExperimentStats?.edgeDarkening,
        interiorMottle:A.lastWatercolourExperimentStats?.interiorMottle,
        paleEdgePooling:A.lastWatercolourExperimentStats?.paleEdgePooling,
        width:left.width,height:left.height,
        tissueBytes:tissueBefore.length,wetBytes:experimentalBefore.length,
        different:tissueBefore!==experimentalBefore,
        paper:A.lastWatercolourExperimentStats?.paper,
        rendererVersion:A.rendererVersion};
      return now;
    });
    assert.equal(result.sameIdentity,true);
    assert.equal(result.wetMaterialIndependent,true);
    assert.equal(result.restoredV6,true,'Stable V6 replay must remain pixel-identical');
    assert.equal(result.repeatWet,true,'Paper/water diffusion must be deterministic');
    // V2e must not soften every edge: both dried and damp/wet marks exist.
    const states=result.washStates||{};
    assert(states.dry>0,'Expected hard dry edges');
    assert(states.damp+states.wet>0,'Expected damp/wet watercolour');
    assert(result.dryDetails>=0);
    assert.match(result.paperFlow.paperModel,/capillary flow/);
    assert(result.paperFlow.diffusionPasses>=3);
    assert(result.paperFlow.waterBlooms>=0&&result.paperFlow.waterBlooms<=4);
    assert.equal(result.widthCaps.broad,127);
    assert.equal(result.widthCaps.hero,67);
    assert(result.washWidths.broadMax<=127);
    assert(result.washWidths.heroMax<=67);
    assert(result.filledPools>=0&&result.mixedPigmentPools>=0);
    assert.equal(result.filledPools,result.mixedPigmentPools);
    assert(result.microBleedCount>0,'Expected ink/wet microbleeds on the thin strokes');
    assert(result.microBleedWashCount>=0);
    assert(result.watercolorThinStrokeCount>0,'All watercolor outlines should use the fine-stroke painter');
    assert(result.dryThinStrokeCount>0,'Even dry fine watercolor strokes must be routed through wet-edged painter');
    assert.equal(result.edgeDarkening,.72);
    assert.equal(result.interiorMottle,.24);
    assert.equal(result.paleEdgePooling,.75);
    assert(result.paperFlow.wetMaskPixels>100,'Genuine wet washes must be captured separately');
    assert(result.paperFlow.transferPixels>0,'Pigment must relocate inside wet wash masks');
    assert(result.paperFlow.donorPixels>0,'Pigment should come from the interior');
    assert(result.paperFlow.edgeBankPixels>0,'Expected physical redistribution near wash boundaries');
    assert(result.paperFlow.edgeBandPeak>.001,'A real edge must receive pigment');
    assert(result.paperFlow.paleEdgeBankPixels>=0);
    assert(result.paperFlow.conservationError<.00002,
      'Optical pigment is being manufactured/lost by the drying-rim pass');
    assert.deepEqual(result.paperFlow.variableBandRange,[3,10]);
    assert.equal(result.different,true,'Watercolour should visually differ from V6');
    assert.equal(result.paper,'#f5f0e6');
    assert.equal(result.rendererVersion,8);
    assert(result.tissueBytes>1000&&result.wetBytes>1000,'Both canvases must contain art');
    await page.locator('#reference').screenshot({path:out+'/'+i+'-v6.png'});
    await page.locator('#experimental').screenshot({path:out+'/'+i+'-wet-edge-v2.png'});
    if(faults.length)throw Error(faults.join('; '));
    console.log('PASS composition',i,JSON.stringify(result));
  }
  await page.close();
}finally{
  await browser.close();
}
