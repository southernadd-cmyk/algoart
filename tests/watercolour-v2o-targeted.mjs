// Exact V2O random gallery seeds reviewed for remaining comb-like burst ticks
// and straight dry rect bars. Render with V2P without changing any controls.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='watercolour-v2o-targeted-v2p';
const cases=[
  {mode:'burst',orientation:'portrait',seed:'WC-V2O-BURST-36D948DEEE',
    elements:33,density:43,complexity:52,negativeSpace:55,phiStrength:93,
    recursion:5,spiralInfluence:62,goldenAngle:83,nesting:58,curveBias:48,
    shapeAmount:48,overlap:46,rotation:53,palette:'mono',colourCount:5,
    saturation:92,brightness:74},
  {mode:'rects',orientation:'landscape',seed:'WC-V2O-RECTS-22DA084F28',
    elements:30,density:67,complexity:75,negativeSpace:65,phiStrength:88,
    recursion:5,spiralInfluence:58,goldenAngle:94,nesting:63,curveBias:61,
    shapeAmount:73,overlap:45,rotation:19,palette:'warm',colourCount:3,
    saturation:96,brightness:74}
];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  await page.goto(new URL('experiments/watercolour-wet-edge-preview.html',root).href,
    {waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>window.__previewReady===true||!!window.__previewError,
    null,{timeout:120000});
  const err=await page.evaluate(()=>window.__previewError||'');
  assert(!err,err);
  const manifest=[];
  for(const scene of cases){
    const result=await page.evaluate(scene=>{
      const A=window.AlgoArt,original=A.oilMaterial;
      const settings={...window.__currentPreviewSettings,...scene,
        pen:'fine',paper:'#f5f0e6',grain:13};
      const canvas=document.createElement('canvas');
      try{
        A.oilMaterial=A.watercolourMaterialExperiment;
        A.renderOil(canvas,settings,1,false,6);
        return {png:canvas.toDataURL('image/png').split(',')[1],
          stats:A.lastWatercolourExperimentStats,
          width:canvas.width,height:canvas.height};
      }finally{A.oilMaterial=original;}
    },scene);
    const t=result.stats.edgeTexture;
    assert(t.samples>100);
    assert(t.drySamples>0);
    assert(t.maxDryDisplacement<=1.251);
    assert(t.maxWetDisplacement<=2.301);
    assert(result.stats.paperFlow.conservationError<.00002);
    assert.equal(result.stats.paper,'#f5f0e6');
    assert.equal(result.width,scene.orientation==='portrait'?1000:1400);
    assert.equal(result.height,scene.orientation==='portrait'?1400:1000);
    const name=scene.mode+'-v2p.png',bytes=Buffer.from(result.png,'base64');
    assert(bytes.length>20000);
    await writeFile(out+'/'+name,bytes);
    manifest.push({...scene,filename:name,bytes:bytes.length,
      edgeTexture:t,softWashCount:result.stats.softWashCount,
      paleFormBoosts:result.stats.paleFormBoosts});
    console.log('PASS TARGET V2O MATCHED',name,scene.seed,JSON.stringify(t));
  }
  await writeFile(out+'/manifest.json',JSON.stringify({
    baseline:'Exact V2O random artworks in run 38594738739 artifact watercolour-eight-random-v2o',
    revision:'V2P edge-only refinement',samples:manifest
  },null,2));
}finally{await browser.close();}
