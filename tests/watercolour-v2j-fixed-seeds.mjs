// EXACT V2j eight-engine samples re-rendered under V2Q; compare with V2L output. Their settings
// and seed strings were copied verbatim from the V2j random manifest.
// Compare against archived V2L matched-seed artifact in run 38554077327, never randomise.
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const folder='watercolour-v2p-v2q-fixed';
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
  assert(!(await page.evaluate(()=>window.__previewError||'')));
  const manifest=[];
  for(const [i,scene] of cases.entries()){
    const images=await page.evaluate(scene=>{
      const A=window.AlgoArt,original=A.oilMaterial;
      const before=A.watercolourV2qOptions.layeredDrying;
      const settings={...window.__currentPreviewSettings,...scene,
        pen:'fine',paper:'#f5f0e6',grain:13};
      const render=enabled=>{
        A.watercolourV2qOptions.layeredDrying=enabled;
        const canvas=document.createElement('canvas'),start=performance.now();
        A.renderOil(canvas,settings,1,false,6);
        return {png:canvas.toDataURL('image/png').split(',')[1],
          stats:A.lastWatercolourExperimentStats,width:canvas.width,
          height:canvas.height,elapsedMs:Math.round(performance.now()-start)};
      };
      try{
        A.oilMaterial=A.watercolourMaterialExperiment;
        const v2p=render(false),v2q=render(true);
        const qRepeat=render(true);
        return {v2p,v2q,
          repeat:qRepeat.png===v2q.png,
          paper:A.lastWatercolourExperimentStats.paper};
      }finally{A.watercolourV2qOptions.layeredDrying=before;A.oilMaterial=original;}
    },scene);
    const {v2p,v2q}=images;
    const sf=v2q.stats.paperFlow;
    assert(images.repeat,'V2Q must replay pixel-identically');
    assert.equal(v2p.stats.layeredDrying,false);
    assert.equal(v2q.stats.layeredDrying,true);
    assert.equal(v2q.stats.paper,'#f5f0e6');
    assert.equal(v2p.stats.paper,'#f5f0e6');
    assert.equal(v2p.stats.compositionPresentation.factor,v2q.stats.compositionPresentation.factor);
    assert.equal(v2p.stats.softWashCount,v2q.stats.softWashCount);
    assert.equal(v2p.stats.areaWashCount,v2q.stats.areaWashCount);
    assert.equal(sf.stageCount,3);
    assert.equal(sf.frozenLayers,2);
    assert.equal(sf.wetOnly,true);
    assert.equal(sf.fixedPixelChanges,0);
    assert.equal(sf.stages.length,3);
    assert.deepEqual(sf.stages.map(s=>s.name),['broad','hero','details']);
    for(const stage of sf.stages){
      assert.equal(stage.transport.fixedPixelChanges,0);
      assert.equal(stage.transport.wetOnly,true);
      assert(stage.addedMass>=0);
      assert(stage.transport.conservationError<.00002);
    }
    assert(sf.mobilePixels>0);
    assert(sf.softConservationError<.00002);
    assert(sf.conservationError<.00002);
    assert(sf.transferPixels>0);
    assert(sf.edgeBankPixels>0);
    assert(sf.softMaskPixels>0);
    assert.notEqual(v2p.png,v2q.png,'Layered drying must produce a real difference');
    assert.equal(v2q.width,scene.orientation==='portrait'?1000:1400);
    assert.equal(v2q.height,scene.orientation==='portrait'?1400:1000);
    const name=String(i+1).padStart(2,'0')+'-'+scene.mode+'-'+scene.orientation;
    const baseline=Buffer.from(v2p.png,'base64'),layered=Buffer.from(v2q.png,'base64');
    assert(baseline.length>15000&&layered.length>15000);
    await writeFile(folder+'/'+name+'-v2p.png',baseline);
    await writeFile(folder+'/'+name+'-v2q.png',layered);
    manifest.push({...scene,name,baseline:name+'-v2p.png',layered:name+'-v2q.png',
      size:[v2q.width,v2q.height],bytes:[baseline.length,layered.length],
      renderMs:{v2p:v2p.elapsedMs,v2q:v2q.elapsedMs},
      stageStats:sf.stages.map(v=>({name:v.name,mobilePixels:v.transport.mobilePixels,
        fixedPixelChanges:v.transport.fixedPixelChanges,addedMass:v.addedMass})),
      paper:'#f5f0e6'});
    console.log('PASS V2P vs V2Q',name,scene.seed,
      'V2P='+v2p.elapsedMs+'ms V2Q='+v2q.elapsedMs+'ms',
      'stages='+sf.stageCount,'frozen='+sf.frozenLayers);
  }
  await writeFile(folder+'/manifest.json',JSON.stringify({
    baseline:'V2P commit 0b16e1732347e7ea5817dc757af56d4f49e5cf9f, same branch toggled off',
    version:'V2Q',note:'Both files from each exact archived seed/settings; independent drying vs one composite post-pass',
    samples:manifest},null,2));
  console.log('PASS 8 exact-seed V2P/V2Q comparisons, three-stage freeze and deterministic replay');
}finally{await browser.close()}
