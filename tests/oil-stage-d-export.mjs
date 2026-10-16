// Full-resolution genuine ALGO/ART Oil export comparison (no image-model output).
// Regression gate: deterministic, same source metadata, changed paint pixels.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const dest='oil-stage-d-export-results';
await mkdir(dest,{recursive:true});
const jobs=[
 {mode:'organic',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-01'},
 {mode:'rects',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-02'}
];
const browser=await chromium.launch({headless:true});
const records=[];
let passed=true;
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?v=9&seed=OIL-D-EXPORT&mode=organic&material=oil-v1',
   {waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV1==='function');
 await page.addScriptTag({url:new URL('js/oil-stage-c-brush.js',base).href});
 for(const spec of jobs){
  const data=await page.evaluate(spec=>{
   const A=window.AlgoArt;
   const s={...A.readSettings(),...spec,palette:'golden',colourCount:8,
     saturation:86,brightness:55,density:67,elements:48,
     complexity:65,negativeSpace:52};
   function run(refined){
     A.oilPerfExperimental=true;A.oilBrushPerfExperimental=true;
     A.oilStageCExperimental=refined;A.oilStageDRefinement=refined;
     A.oilStageCScale=1;
     A.oilStageCStats={};
     try{
       const canvas=document.createElement('canvas');
       const start=performance.now(),meta=A.renderOilPaintV1(canvas,s,1,false);
       const ms=performance.now()-start;
       const stats={...A.oilStageCStats};
       return {ms,png:canvas.toDataURL('image/png'),
         dimensions:[canvas.width,canvas.height],
         geometry:JSON.stringify({guide:meta.guide,voids:meta.voids,strategy:meta.strategy}),
         stats};
     }finally{
       A.oilPerfExperimental=false;A.oilBrushPerfExperimental=false;
       A.oilStageCExperimental=false;A.oilStageDRefinement=false;
       A.oilStageCScale=null;A.oilStageCStats=null;
     }
   }
   run(false);run(true); // excluded warmups
   const v1=run(false),refined=run(true),repeat=run(true);
   return {v1,refined,repeat};
  },spec);
  const name=spec.mode+'-'+spec.orientation;
  for(const [k,title] of [['v1','v1'],['refined','refined']]){
   const raw=data[k].png.split(',')[1];
   await writeFile(dest+'/'+name+'-'+title+'.png',Buffer.from(raw,'base64'));
  }
  const summary={name,
    dimensions:data.refined.dimensions,
    v1Ms:+data.v1.ms.toFixed(1),refinedMs:+data.refined.ms.toFixed(1),
    overheadPercent:+(100*(data.refined.ms-data.v1.ms)/data.v1.ms).toFixed(1),
    repeatDeterministic:data.refined.png===data.repeat.png,
    geometrySame:data.refined.geometry===data.v1.geometry,
    imageChanged:data.refined.png!==data.v1.png,
    refinedBrushCalls:data.refined.stats.brushCalls||0,
    refinedHairs:data.refined.stats.physicalHairs||0,
    detailFallbacks:data.refined.stats.fallbackCalls||0,
    bent:data.refined.stats.bent||0};
  records.push(summary);
  console.log('STAGE_D_EXPORT '+JSON.stringify(summary));
  if(!summary.repeatDeterministic||!summary.geometrySame||
     !summary.imageChanged||summary.refinedHairs<100)passed=false;
 }
 if(errors.length){passed=false;console.log('PAGE_ERRORS '+JSON.stringify(errors))}
}finally{
 await writeFile(dest+'/results.json',JSON.stringify({
  scale:1,cases:records,passed,
  warning:'CI timings are exploratory, not statistically guaranteed.'},null,2));
 await browser.close();
}
assert(passed,'Full-resolution Stage D correctness gate failed');
console.log('PASS: two full-resolution ALGO/ART Oil V1 vs Stage D deterministic comparisons');
