// Exact V2O random gallery seeds reviewed for remaining comb-like burst ticks
// and straight dry rect bars. Render with both V2P and V2Q without changing any controls.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='watercolour-v2o-targeted-v2q';
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
      const previous=A.watercolourV2qOptions.layeredDrying;
      const settings={...window.__currentPreviewSettings,...scene,
        pen:'fine',paper:'#f5f0e6',grain:13};
      const render=enabled=>{
        A.watercolourV2qOptions.layeredDrying=enabled;
        const canvas=document.createElement('canvas');
        A.renderOil(canvas,settings,1,false,6);
        return {png:canvas.toDataURL('image/png').split(',')[1],
          stats:A.lastWatercolourExperimentStats,width:canvas.width,height:canvas.height};
      };
      try{
        A.oilMaterial=A.watercolourMaterialExperiment;
        return {v2p:render(false),v2q:render(true)};
      }finally{
        A.watercolourV2qOptions.layeredDrying=previous;
        A.oilMaterial=original;
      }
    },scene);
    const {v2p,v2q}=result,t=v2q.stats.edgeTexture;
    assert(t.samples>100&&t.drySamples>0);
    assert(t.maxDryDisplacement<=1.251&&t.maxWetDisplacement<=2.301);
    assert.equal(v2q.stats.paperFlow.stageCount,3);
    assert.equal(v2q.stats.paperFlow.fixedPixelChanges,0);
    assert(v2q.stats.paperFlow.conservationError<.00002);
    assert.equal(v2q.stats.paper,'#f5f0e6');
    assert.equal(v2p.stats.paper,'#f5f0e6');
    assert.equal(v2q.width,scene.orientation==='portrait'?1000:1400);
    assert.equal(v2q.height,scene.orientation==='portrait'?1400:1000);
    assert.notEqual(v2p.png,v2q.png,'Stage freezing must visibly differ');
    const files=[];
    for(const [rev,render] of Object.entries(result)){
      const name=scene.mode+'-'+rev+'.png',bytes=Buffer.from(render.png,'base64');
      assert(bytes.length>20000);
      await writeFile(out+'/'+name,bytes);
      files.push({name,bytes:bytes.length});
    }
    manifest.push({...scene,files,edgeTexture:t,
      softWashCount:v2q.stats.softWashCount,
      paleFormBoosts:v2q.stats.paleFormBoosts,
      frozenLayers:v2q.stats.paperFlow.frozenLayers});
    console.log('PASS TARGET V2P/V2Q',scene.mode,scene.seed,JSON.stringify(files));
  }
  await writeFile(out+'/manifest.json',JSON.stringify({
    baseline:'Exact V2O random artworks in run 38594738739 artifact watercolour-eight-random-v2o',
    revision:'V2Q independent wet-only drying stages vs unchanged V2P baseline',samples:manifest
  },null,2));
}finally{await browser.close();}
