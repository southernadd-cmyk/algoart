// EXACT V2j eight-engine samples re-rendered under V2M; compare with V2L output. Their settings
// and seed strings were copied verbatim from the V2j random manifest.
// Compare against archived V2L matched-seed artifact in run 38554077327, never randomise.
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const folder='watercolour-same-seed-v2k-v2m';
await mkdir(folder,{recursive:true});
const keys=['mode','orientation','seed','elements','density','complexity',
  'negativeSpace','phiStrength','recursion','spiralInfluence','goldenAngle',
  'nesting','curveBias','shapeAmount','overlap','rotation','palette',
  'colourCount','saturation','brightness'];
const fixtures=[["field","landscape","WC-V2J-FIELD-78F3B0412F",39,46,45,41,95,3,78,88,37,49,74,53,76,"golden",4,77,73],["spiral","portrait","WC-V2J-SPIRAL-1ED8718CDF",19,55,52,54,93,5,62,93,38,82,44,76,66,"earth",4,97,60],["rects","landscape","WC-V2J-RECTS-5D67CB7538",25,70,56,50,93,5,76,94,63,69,45,41,22,"warm",4,97,65],["burst","portrait","WC-V2J-BURST-8464B1CCA7",34,52,60,52,85,5,49,93,50,83,69,67,74,"mono",4,85,70],["network","landscape","WC-V2J-NETWORK-114D2A2AC3",41,66,79,62,88,5,64,95,43,87,65,57,37,"golden",4,77,75],["scribble","portrait","WC-V2J-SCRIBBLE-ADEB84E17B",27,56,63,66,98,3,69,93,46,76,76,48,80,"earth",4,86,62],["organic","landscape","WC-V2J-ORGANIC-EDFEE52749",41,48,50,61,93,3,63,93,53,62,58,68,83,"warm",5,82,65],["geometric","portrait","WC-V2J-GEOMETRIC-E842A5FA8B",24,69,63,48,94,5,58,97,48,84,43,52,85,"mono",3,78,68]];
const cases=fixtures.map(x=>Object.fromEntries(keys.map((k,i)=>[k,x[i]])));
assert.equal(new Set(cases.map(s=>s.seed)).size,8);
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  page.setDefaultTimeout(180000);
  await page.goto(new URL('experiments/watercolour-wet-edge-preview.html',root).href,
    {waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>window.__previewReady===true||!!window.__previewError,
    null,{timeout:120000});
  const error=await page.evaluate(()=>window.__previewError||'');
  assert(!error,error);
  const manifest=[];
  for(const [i,scenario] of cases.entries()){
    const result=await page.evaluate(scene=>{
      const A=window.AlgoArt,original=A.oilMaterial;
      const settings={...window.__currentPreviewSettings,...scene,
        pen:'fine',paper:'#f5f0e6',grain:13};
      const canvas=document.createElement('canvas');
      try{
        A.oilMaterial=A.watercolourMaterialExperiment;
        A.renderOil(canvas,settings,1,false,6);
        return {png:canvas.toDataURL('image/png').split(',')[1],
          width:canvas.width,height:canvas.height,
          stats:A.lastWatercolourExperimentStats};
      }finally{A.oilMaterial=original;}
    },scenario);
    assert.equal(result.width,scenario.orientation==='portrait'?1000:1400);
    assert.equal(result.height,scenario.orientation==='portrait'?1400:1000);
    assert.equal(result.stats.paper,'#f5f0e6');
    assert.equal(result.stats.edgeDarkening,.72);
    assert.equal(result.stats.interiorMottle,.24);
    assert.equal(result.stats.paleEdgePooling,.75);
    assert.equal(result.stats.edgeBandRadius,8);
    assert(result.stats.paperFlow.edgeBandPeak>.20);
    assert(result.stats.paperFlow.edgeBankPixels>0);
    assert(result.stats.watercolorThinStrokeCount>0);
    const bytes=Buffer.from(result.png,'base64');
    assert(bytes.length>15000);
    const filename=String(i+1).padStart(2,'0')+'-'+scenario.mode+'-'+scenario.orientation+'.png';
    await writeFile(folder+'/'+filename,bytes);
    manifest.push({...scenario,filename,width:result.width,height:result.height,
      bytes:bytes.length,edgeDarkening:result.stats.edgeDarkening,
      interiorMottle:result.stats.interiorMottle,materialStats:{
        microBleedCount:result.stats.microBleedCount,
        waterBlooms:result.stats.paperFlow.waterBlooms,
        pigmentSpreadMax:result.stats.pigmentSpreadMax,
        compositionPresentation:result.stats.compositionPresentation}});
    console.log('FIXED V2L BASELINE V2M RENDER',filename,scenario.seed,bytes.length);
  }
  await writeFile(folder+'/manifest.json',JSON.stringify({
    baseline:'GitHub Actions run 38554077327 watercolour-eight-fixed-v2j-v2l',
    version:'V2M',note:'Exactly same seeds and generation controls as archived V2L matched-seed set',
    samples:manifest},null,2));
  console.log('PASS: 8 V2M images with exact archived V2L seeds');
}finally{await browser.close()}
