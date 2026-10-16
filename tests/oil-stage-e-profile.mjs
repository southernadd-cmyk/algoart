// Stage E: instrument real ALGO/ART Oil brush/wet-pickup/mask-read/height-scan cost.
// Requires pixel-identical output for new mask scanner; no production changes.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const dir='oil-stage-e-profiling';
await mkdir(dir,{recursive:true});
const jobs=[
 {mode:'organic',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-01',scale:.65},
 {mode:'rects',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-02',scale:.65},
 {mode:'network',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-03',scale:.65},
 {mode:'burst',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-04',scale:.65},
 {mode:'organic',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-01',scale:1},
 {mode:'rects',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-02',scale:1}
];
const browser=await chromium.launch({headless:true});
const reports=[];
let ok=true;
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?v=9&seed=OIL-STAGE-E-START&mode=organic&material=oil-v1',
  {waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV1==='function');
 await page.addScriptTag({url:new URL('js/oil-stage-c-brush.js',base).href});
 for(const job of jobs){
  const result=await page.evaluate(job=>{
   const A=window.AlgoArt;
   const settings={...A.readSettings(),...job,palette:'golden',colourCount:8,
     saturation:86,brightness:55,density:67,elements:48,
     complexity:65,negativeSpace:52};
   function run(scan,save=false){
    A.oilPerfExperimental=true;
    A.oilBrushPerfExperimental=true;
    A.oilStageCExperimental=true;
    A.oilStageDRefinement=true;
    A.oilStageCScale=job.scale;
    A.oilStageEMaskScanExperimental=scan;
    A.oilStageEBatchWetSample=scan;
    A.oilStageETightMaskExperimental=scan;
    A.oilStageEProfile={};
    A.oilStageCStats={};
    try{
     const c=document.createElement('canvas');
     const start=performance.now(),meta=A.renderOilPaintV1(c,settings,job.scale,false);
     return {ms:performance.now()-start,
       stats:{...A.oilStageEProfile},bristles:{...A.oilStageCStats},
       geometry:JSON.stringify({guide:meta.guide,voids:meta.voids,strategy:meta.strategy}),
       png:save?c.toDataURL('image/png'):null,
       dims:[c.width,c.height]};
    }finally{
     A.oilStageEMaskScanExperimental=false;
     A.oilStageEBatchWetSample=false;
     A.oilStageETightMaskExperimental=false;A.oilStageEProfile=null;
     A.oilPerfExperimental=false;A.oilBrushPerfExperimental=false;
     A.oilStageCExperimental=false;A.oilStageDRefinement=false;
     A.oilStageCScale=null;A.oilStageCStats=null;
    }
   }
   run(false);run(true); // warmup
   const before=run(false,true),after=run(true,true);
   const timesBefore=[],timesAfter=[];
   for(let i=0;i<3;i++){
    if(i%2===0){timesBefore.push(run(false).ms);timesAfter.push(run(true).ms)}
    else {timesAfter.push(run(true).ms);timesBefore.push(run(false).ms)}
   }
   timesBefore.sort((a,b)=>a-b);timesAfter.sort((a,b)=>a-b);
   return {before,after,identical:before.png===after.png,
     medianBaseline:timesBefore[1],medianOptimized:timesAfter[1]};
  },job);
  const key=job.mode+'-'+job.orientation+'-'+String(job.scale).replace('.','p');
  const toBytes=d=>Buffer.from(d.slice(d.indexOf(',')+1),'base64');
  await writeFile(dir+'/'+key+'-baseline.png',toBytes(result.before.png));
  await writeFile(dir+'/'+key+'-fast.png',toBytes(result.after.png));
  const record={case:key,exactPixels:result.identical,
    geometrySame:result.before.geometry===result.after.geometry,
    size:result.before.dims,
    baselineMs:+result.medianBaseline.toFixed(2),
    optimizedMs:+result.medianOptimized.toFixed(2),
    gainPercent:+(100*(result.medianBaseline-result.medianOptimized)/result.medianBaseline).toFixed(1),
    baselinePhases:result.before.stats,
    optimizedPhases:result.after.stats,
    detailedBrushCalls:result.after.bristles.brushCalls||0};
  console.log('STAGE_E '+JSON.stringify(record));
  reports.push(record);
  if(!record.exactPixels||!record.geometrySame)ok=false;
 }
 if(errors.length){console.log('PAGE_ERRORS '+JSON.stringify(errors));ok=false}
}finally{
 await writeFile(dir+'/results.json',JSON.stringify({reports,passed:ok,
   warning:'Median of 3 warmed samples; results vary with runner conditions.'},null,2));
 await browser.close();
}
assert(ok,'Mask optimisation must not change oil image pixels or geometry');
console.log('PASS: batched wet pigment samples and height scans are exactly pixel-identical');
