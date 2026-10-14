// V2R dry-media experiment: exact V2P baseline and V2R paired renders.
// Both renderers run on the SAME branch, with only the dry-media switch changed.
// No editor, production code, source geometry or existing V2P commit altered.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const output='watercolour-v2p-v2r-pairs';
await mkdir(output,{recursive:true});
const keys=['mode','orientation','seed','elements','density','complexity',
  'negativeSpace','phiStrength','recursion','spiralInfluence','goldenAngle',
  'nesting','curveBias','shapeAmount','overlap','rotation','palette',
  'colourCount','saturation','brightness'];
const fixtures=[["field","landscape","WC-V2J-FIELD-78F3B0412F",39,46,45,41,95,3,78,88,37,49,74,53,76,"golden",4,77,73],["spiral","portrait","WC-V2J-SPIRAL-1ED8718CDF",19,55,52,54,93,5,62,93,38,82,44,76,66,"earth",4,97,60],["rects","landscape","WC-V2J-RECTS-5D67CB7538",25,70,56,50,93,5,76,94,63,69,45,41,22,"warm",4,97,65],["burst","portrait","WC-V2J-BURST-8464B1CCA7",34,52,60,52,85,5,49,93,50,83,69,67,74,"mono",4,85,70],["network","landscape","WC-V2J-NETWORK-114D2A2AC3",41,66,79,62,88,5,64,95,43,87,65,57,37,"golden",4,77,75],["scribble","portrait","WC-V2J-SCRIBBLE-ADEB84E17B",27,56,63,66,98,3,69,93,46,76,76,48,80,"earth",4,86,62],["organic","landscape","WC-V2J-ORGANIC-EDFEE52749",41,48,50,61,93,3,63,93,53,62,58,68,83,"warm",5,82,65],["geometric","portrait","WC-V2J-GEOMETRIC-E842A5FA8B",24,69,63,48,94,5,58,97,48,84,43,52,85,"mono",3,78,68]];
const cases=fixtures.map(x=>Object.fromEntries(keys.map((k,i)=>[k,x[i]])));
assert.equal(new Set(cases.map(s=>s.seed)).size,8);


const targetCases=[
  {mode:'spiral',orientation:'portrait',seed:'WC-V2Q-SPIRAL-445F23F366',
    elements:34,density:71,complexity:58,negativeSpace:58,phiStrength:99,
    recursion:4,spiralInfluence:76,goldenAngle:92,nesting:57,curveBias:40,
    shapeAmount:52,overlap:56,rotation:85,palette:'earth',
    colourCount:4,saturation:81,brightness:52},
  {mode:'network',orientation:'landscape',seed:'WC-V2Q-NETWORK-3BF8679A17',
    elements:27,density:48,complexity:76,negativeSpace:50,phiStrength:89,
    recursion:4,spiralInfluence:76,goldenAngle:93,nesting:65,curveBias:51,
    shapeAmount:67,overlap:41,rotation:43,palette:'golden',
    colourCount:5,saturation:94,brightness:56}
];

const all=cases.concat(targetCases);
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
 for(const [i,scene] of all.entries()){
  const result=await page.evaluate(scene=>{
   const A=window.AlgoArt,renderer=A.oilMaterial,original=A.watercolourV2rOptions.dryMedia;
   const settings={...window.__currentPreviewSettings,...scene,
     pen:'fine',paper:'#f5f0e6',grain:13};
   function render(enable){
     A.watercolourV2rOptions.dryMedia=enable;
     const canvas=document.createElement('canvas'),started=performance.now();
     A.renderOil(canvas,settings,1,false,6);
     return {png:canvas.toDataURL('image/png').split(',')[1],
       stats:A.lastWatercolourExperimentStats,
       elapsedMs:Math.round(performance.now()-started),
       width:canvas.width,height:canvas.height};
   }
   try{
    A.oilMaterial=A.watercolourMaterialExperiment;
    const baseline=render(false),polished=render(true);
    // Pixel determinism must survive a whole V2P/V2R/V2P sequence.
    const repeat=render(true);
    const baselineAgain=render(false);
    return {baseline,polished,polishedRepeat:repeat.png===polished.png,
      baselineRepeat:baselineAgain.png===baseline.png};
   }finally{
    A.watercolourV2rOptions.dryMedia=original;A.oilMaterial=renderer;
   }
  },scene);
  assert(result.polishedRepeat,'V2R output must repeat exactly: '+scene.mode);
  assert(result.baselineRepeat,'V2P fallback must repeat exactly: '+scene.mode);
  assert.equal(result.baseline.stats.dryMediaEnabled,false);
  assert.equal(result.polished.stats.dryMediaEnabled,true);
  assert.equal(result.polished.stats.paper,'#f5f0e6');
  assert.equal(result.polished.width,scene.orientation==='portrait'?1000:1400);
  assert.equal(result.polished.height,scene.orientation==='portrait'?1400:1000);
  const b=result.baseline.stats,p=result.polished.stats;
  assert.deepEqual(p.compositionPresentation,b.compositionPresentation);
  assert.deepEqual(p.washStates,b.washStates);
  assert.deepEqual(p.paperFlow,b.paperFlow,'Wet pigment transport changed for '+scene.mode);
  assert.deepEqual(p.edgeTexture,b.edgeTexture,'Wet paper edge field changed for '+scene.mode);
  assert.equal(p.softWashCount,b.softWashCount);
  assert.equal(p.areaWashCount,b.areaWashCount);
  assert(p.dryMedia.continuousDryStrokes>0,'No dry-brush paths');
  assert(p.dryMedia.continuousSamples>=p.dryMedia.continuousDryStrokes*2);
  assert(p.dryMedia.dryBrushHoles>=0);
  assert(p.dryMedia.dryShardCount>=0);
  assert(p.dryMedia.dryShardHoles>=0);
  assert.notEqual(result.baseline.png,result.polished.png,'No visible material change');
  const name=String(i+1).padStart(2,'0')+'-'+scene.mode+
    (i>=cases.length?'-review':'');
  const files=[];
  for(const [variant,item] of [['v2p',result.baseline],['v2r',result.polished]]){
   const filename=name+'-'+variant+'.png',bytes=Buffer.from(item.png,'base64');
   assert(bytes.length>15000,'Missing visible art');
   await writeFile(output+'/'+filename,bytes);
   files.push({variant,filename,bytes:bytes.length,elapsedMs:item.elapsedMs});
  }
  manifest.push({...scene,files,material:p.dryMedia,reference:'V2P toggled off'});
  console.log('PASS V2R MATCH',name,scene.seed,
    'dry strokes='+p.dryMedia.continuousDryStrokes,
    'dry shards='+p.dryMedia.dryShardCount,
    'time '+result.baseline.elapsedMs+'/'+result.polished.elapsedMs+'ms');
 }
 await writeFile(output+'/manifest.json',JSON.stringify({
  name:'V2R dry brush and shard granulation exact V2P comparisons',
  baseline:'V2P committed at 0b16e1732347e7ea5817dc757af56d4f49e5cf9f',
  method:'Both versions same branch, same seed/parameters; only dryMedia option toggled',
  sourceForReviewSeeds:'V2Q random eight manifest (spiral and network)',
  samples:manifest
 },null,2));
 console.log('PASS all '+all.length+' identical-seed V2P/V2R comparisons');
}finally{await browser.close();}
