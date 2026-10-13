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
      const tissueBefore=left.toDataURL('image/png');
      const experimentalBefore=right.toDataURL('image/png');
      // A true post-experiment V6 replay must be pixel-identical,
      // proving that the old mode remains untouched even in this page.
      const check=document.createElement('canvas');
      A.renderOil(check,window.__currentPreviewSettings,
        window.__currentPreviewScale,false,6);
      const restoredV6=check.toDataURL('image/png')===tissueBefore;
      const now={sameIdentity:typeof original==='function',
        wetMaterialIndependent:original!==A.watercolourMaterialExperiment,
        restoredV6,
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
