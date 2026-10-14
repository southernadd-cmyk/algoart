// Eight fresh, genuinely random V2M studies — ONE from each V8 engine.
// This is a screenshot/artwork sampler, not a production publishing path.
// Each image and its full seed/settings are saved for deterministic reproduction.
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const output='watercolour-eight-random';
await mkdir(output,{recursive:true});

const engines=[
  {mode:'field',name:'Orbital Studies',orientation:'landscape'},
  {mode:'spiral',name:'Golden Trajectories',orientation:'portrait'},
  {mode:'rects',name:'Recursive Divisions',orientation:'landscape'},
  {mode:'burst',name:'Radiant Systems',orientation:'portrait'},
  {mode:'network',name:'Connected Fields',orientation:'landscape'},
  {mode:'scribble',name:'Automatic Marks',orientation:'portrait'},
  {mode:'organic',name:'Growth Systems',orientation:'landscape'},
  {mode:'geometric',name:'Constructed Forms',orientation:'portrait'}
];

// One random seed per composition; PR reruns generate new art. All sampled
// parameters are written to manifest.json so the images remain reproducible.
function randInt(low,high){return low+randomBytes(4).readUInt32BE(0)%(high-low+1)}
const palettes=['golden','earth','warm','mono'];
const scenarios=engines.map((engine,index)=>({
  ...engine,
  seed:'WC-V2M-'+engine.mode.toUpperCase()+'-'+randomBytes(5).toString('hex').toUpperCase(),
  elements:randInt(18,42),
  density:randInt(43,73),
  complexity:randInt(43,81),
  negativeSpace:randInt(41,69),
  phiStrength:randInt(84,99),
  recursion:randInt(3,5),
  spiralInfluence:randInt(38,78),
  goldenAngle:randInt(82,98),
  nesting:randInt(37,70),
  curveBias:randInt(38,88),
  shapeAmount:randInt(42,77),
  overlap:randInt(41,77),
  rotation:randInt(18,88),
  palette:palettes[index%palettes.length],
  colourCount:randInt(3,5),
  saturation:randInt(77,97),
  brightness:randInt(52,76)
}));
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  page.setDefaultTimeout(180000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('experiments/watercolour-wet-edge-preview.html',root).href,
    {waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>window.__previewReady===true||!!window.__previewError,
    null,{timeout:180000});
  const firstError=await page.evaluate(()=>window.__previewError||'');
  if(firstError)throw new Error('Preview setup: '+firstError);
  const manifest=[];
  for(const [i,scenario] of scenarios.entries()){
    // Use the proven preview's original V8 composer and newest experimental
    // paper material. The global painter is always restored on exit.
    const result=await page.evaluate((scenario)=>{
      const A=window.AlgoArt,original=A.oilMaterial;
      const settings={...window.__currentPreviewSettings,...scenario,
        pen:'fine',paper:'#f5f0e6',grain:13};
      delete settings.name;
      const canvas=document.createElement('canvas');
      let meta;
      try{
        A.oilMaterial=A.watercolourMaterialExperiment;
        meta=A.renderOil(canvas,settings,1,false,6);
        return {
          data:canvas.toDataURL('image/png').split(',')[1],
          width:canvas.width,height:canvas.height,
          meta:{strategy:meta.strategy,voids:(meta.voids||[]).length},
          material:A.lastWatercolourExperimentStats,
          settings
        };
      }finally{A.oilMaterial=original;}
    },scenario);
    assert.equal(result.width,scenario.orientation==='portrait'?1000:1400);
    assert.equal(result.height,scenario.orientation==='portrait'?1400:1000);
    assert.equal(result.material.paper,'#f5f0e6');
    assert(result.material.chains>0,'Expected nonempty geometry: '+scenario.mode);
    assert(result.material.washStates.dry>0,'Expected preserved crisp dry edges: '+scenario.mode);
    assert(result.material.washStates.wet+result.material.washStates.damp>0,
      'Expected water-mobile translucent washes: '+scenario.mode);
    assert(result.material.paperFlow.diffusionPasses>=3);
    assert.equal(result.material.widthCaps.broad,127);
    assert.equal(result.material.widthCaps.hero,67);
    assert(result.material.washWidths.broadMax<=127);
    assert(result.material.washWidths.heroMax<=67);
    assert(result.material.chromaticAccents>=0);
    assert(result.material.filledPools>=0&&result.material.mixedPigmentPools>=0);
    assert.equal(result.material.filledPools,result.material.mixedPigmentPools);
    assert(result.material.microBleedCount>0,'No microbleed on '+scenario.mode);
    assert(result.material.watercolorThinStrokeCount>0,'No watercolour fine lines on '+scenario.mode);
    assert(result.material.dryThinStrokeCount>0,'Dry fine lines bypass watercolour on '+scenario.mode);
    assert(result.material.pigmentSpreadMax<=112,'Pigment gamut too electronic: '+scenario.mode);
    assert.equal(result.material.edgeDarkening,.72);
    assert.equal(result.material.interiorMottle,.24);
    assert.equal(result.material.paleEdgePooling,.75);
    assert.equal(result.material.edgeBandRadius,8);
    assert(result.material.paperFlow.edgeBankPixels>100);
    assert(result.material.paperFlow.edgeBandPeak>.20,
      'Pigment band is too weak: '+scenario.mode);
    assert(result.material.paperFlow.edgeBankPixels>0,'Expected paper-space edge banks: '+scenario.mode);
    assert(result.material.paperFlow.paleEdgeBankPixels>=0);
    assert(result.material.compositionPresentation.factor>0);
    if(result.material.compositionPresentation.kind==='compact-source-reframe')
      assert(result.material.compositionPresentation.after.width>=result.material.compositionPresentation.before.width*1.15);
    const png=Buffer.from(result.data,'base64');
    assert(png.length>15000,'Unexpected blank or tiny png: '+scenario.mode);
    const filename=String(i+1).padStart(2,'0')+'-'+scenario.mode+'-'+scenario.orientation+'.png';
    await writeFile(output+'/'+filename,png);
    manifest.push({filename,name:scenario.name,...result.settings,
      width:result.width,height:result.height,pngBytes:png.length,
      geometry:result.meta,paperFlow:result.material.paperFlow,
      washWidths:result.material.washWidths,chromaticAccents:result.material.chromaticAccents,
      filledPools:result.material.filledPools,mixedPigmentPools:result.material.mixedPigmentPools,
      microBleedCount:result.material.microBleedCount,
      watercolorThinStrokeCount:result.material.watercolorThinStrokeCount,
      dryThinStrokeCount:result.material.dryThinStrokeCount,
      compositionPresentation:result.material.compositionPresentation,
      pigmentSpreadMax:result.material.pigmentSpreadMax});
    console.log('RENDERED',filename,png.length+' bytes',
      'seed='+scenario.seed,'paths='+result.material.chains,
      'washStates='+JSON.stringify(result.material.washStates),
      'accents='+result.material.chromaticAccents,'filledPools='+result.material.filledPools);
  }
  assert.equal(manifest.length,8);
  assert.equal(new Set(manifest.map(x=>x.seed)).size,8);
  assert.equal(errors.length,0,'Browser errors: '+errors.join('; '));
  await writeFile(output+'/manifest.json',JSON.stringify({
    description:'8 unique random studies in experimental Watercolour V2M',
    material:'watercolour-v2m-paper-diffusion',rendererVersion:8,
    revision:'experimental branch only; no production changes',
    samples:manifest
  },null,2));
  console.log('PASS: 8 new independent, reproducible V2M watercolour PNGs');
// Fixed V2i seeds from the user's visual review. These are NOT the random
// gallery; they are four extra regression images proving the compact-cluster
// and edge-clipped-frame conditions have been addressed on exact inputs.
const priorCases=[
  {name:'prior-field',seed:'WC-V2I-FIELD-0F3FFB0E1D',mode:'field',orientation:'landscape',elements:28,density:45,complexity:76,negativeSpace:61,phiStrength:90,recursion:3,spiralInfluence:48,goldenAngle:94,nesting:60,curveBias:77,shapeAmount:63,overlap:72,rotation:65,palette:'golden',colourCount:5,saturation:92,brightness:55},
  {name:'prior-network',seed:'WC-V2I-NETWORK-8D3CABC0BA',mode:'network',orientation:'landscape',elements:18,density:68,complexity:80,negativeSpace:48,phiStrength:93,recursion:3,spiralInfluence:56,goldenAngle:97,nesting:42,curveBias:52,shapeAmount:51,overlap:45,rotation:70,palette:'golden',colourCount:4,saturation:82,brightness:55},
  {name:'prior-scribble',seed:'WC-V2I-SCRIBBLE-1F9904EA55',mode:'scribble',orientation:'portrait',elements:42,density:46,complexity:73,negativeSpace:50,phiStrength:88,recursion:5,spiralInfluence:44,goldenAngle:82,nesting:39,curveBias:64,shapeAmount:65,overlap:76,rotation:59,palette:'earth',colourCount:4,saturation:87,brightness:56},
  {name:'prior-rects',seed:'WC-V2I-RECTS-1E442E7959',mode:'rects',orientation:'landscape',elements:34,density:61,complexity:54,negativeSpace:46,phiStrength:95,recursion:5,spiralInfluence:53,goldenAngle:94,nesting:43,curveBias:39,shapeAmount:73,overlap:42,rotation:47,palette:'warm',colourCount:3,saturation:78,brightness:73}
];
const fixedDir=output+'/fixed';
await mkdir(fixedDir,{recursive:true});
const fixedManifest=[];
for(const fixture of priorCases){
  const result=await page.evaluate((scene)=>{
    const A=window.AlgoArt,original=A.oilMaterial;
    const settings={...window.__currentPreviewSettings,...scene,
      pen:'fine',paper:'#f5f0e6',grain:13};
    delete settings.name;
    const canvas=document.createElement('canvas');
    try{
      A.oilMaterial=A.watercolourMaterialExperiment;
      A.renderOil(canvas,settings,1,false,6);
      return {data:canvas.toDataURL('image/png').split(',')[1],
        stats:A.lastWatercolourExperimentStats.compositionPresentation,
        pigmentSpreadMax:A.lastWatercolourExperimentStats.pigmentSpreadMax,
        width:canvas.width,height:canvas.height};
    }finally{A.oilMaterial=original;}
  },fixture);
  assert(result.pigmentSpreadMax<=112);
  if(fixture.mode!=='rects'){
    assert.equal(result.stats.kind,'compact-source-reframe',
      'Previously tiny '+fixture.mode+' should be reframed');
    assert(result.stats.after.width>result.stats.before.width*1.20,
      'Reframe needs measurable width gain: '+fixture.mode);
  }else if(fixture.mode==='rects'){
    assert.equal(result.stats.kind,'frame-inset','Previously clipped RECT frame needs inset');
    assert(result.stats.factor<=.88);
    assert(result.stats.factor<1);
    assert(result.stats.after.minX>0&&result.stats.after.maxX<1);
  }
  const filename=fixture.name+'.png';
  await writeFile(fixedDir+'/'+filename,Buffer.from(result.data,'base64'));
  fixedManifest.push({filename,seed:fixture.seed,mode:fixture.mode,
    bounds:result.stats,pigmentSpreadMax:result.pigmentSpreadMax});
  console.log('FIXED V2I REGRESSION',fixture.name,JSON.stringify(result.stats));
}
await writeFile(fixedDir+'/manifest.json',JSON.stringify(fixedManifest,null,2));

}finally{
  await browser.close();
}
