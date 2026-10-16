// Real ALGO/ART Oil Stage E selective low-memory export cache.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const dir='oil-stage-e-adaptive-results';
await mkdir(dir,{recursive:true});
const jobs=[
 {mode:'organic',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-01',scale:.65},
 {mode:'rects',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-02',scale:.65},
 {mode:'organic',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-01',scale:1},
 {mode:'rects',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-02',scale:1}
];
const browser=await chromium.launch({headless:true});
const records=[];
let valid=true;
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'?v=9&seed=OIL-E-ADAPTIVE&mode=organic&material=oil-v1',
   {waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV1==='function');
 await page.addScriptTag({url:new URL('js/oil-stage-c-brush.js',root).href});
 for(const spec of jobs){
  const result=await page.evaluate(spec=>{
   const A=window.AlgoArt;
   const settings={...A.readSettings(),...spec,palette:'golden',colourCount:8,
     saturation:86,brightness:55,density:67,elements:48,
     complexity:65,negativeSpace:52};
   function run(adaptive,save=false){
     A.oilPerfExperimental=true;A.oilBrushPerfExperimental=true;
     A.oilStageCExperimental=true;A.oilStageDRefinement=true;
     A.oilStageCScale=spec.scale;
     A.oilStageEAdaptiveLightingExperimental=adaptive;
     A.oilStageEAdapterProfile={};
     try{
       const canvas=document.createElement('canvas');
       const t=performance.now();
       const meta=A.renderOilPaintV1(canvas,settings,spec.scale,false);
       return {ms:performance.now()-t,
         profile:{...A.oilStageEAdapterProfile},
         png:save?canvas.toDataURL('image/png'):null,
         dims:[canvas.width,canvas.height],
         geometry:JSON.stringify({guide:meta.guide,voids:meta.voids,strategy:meta.strategy})};
     }finally{
       A.oilPerfExperimental=false;A.oilBrushPerfExperimental=false;
       A.oilStageCExperimental=false;A.oilStageDRefinement=false;
       A.oilStageCScale=null;A.oilStageEAdaptiveLightingExperimental=false;
       A.oilStageEAdapterProfile=null;
     }
   }
   run(false);run(true);
   const before=run(false,true),after=run(true,true);
   const oldTimes=[],newTimes=[];
   for(let i=0;i<3;i++){
     if(i%2===0){oldTimes.push(run(false).ms);newTimes.push(run(true).ms)}
     else{newTimes.push(run(true).ms);oldTimes.push(run(false).ms)}
   }
   oldTimes.sort((a,b)=>a-b);newTimes.sort((a,b)=>a-b);
   return {before,after,oldMs:oldTimes[1],newMs:newTimes[1]};
  },spec);
  const k=spec.mode+'-'+spec.orientation+'-'+String(spec.scale).replace('.','p');
  const bytes=d=>Buffer.from(d.slice(d.indexOf(',')+1),'base64');
  await writeFile(dir+'/'+k+'-reference.png',bytes(result.before.png));
  await writeFile(dir+'/'+k+'-adaptive.png',bytes(result.after.png));
  const mustCache=result.after.dims[0]*result.after.dims[1]>=900000;
  const rowCacheBytes=result.after.profile.extraHeightBytes||0;
  const record={case:k,referenceMs:+result.oldMs.toFixed(1),
    adaptiveMs:+result.newMs.toFixed(1),
    gainPct:+(100*(result.oldMs-result.newMs)/result.oldMs).toFixed(1),
    outputIdentical:result.before.png===result.after.png,
    geometrySame:result.before.geometry===result.after.geometry,
    rowsExpected:mustCache,rowsEnabled:rowCacheBytes>0,
    extraBytes:rowCacheBytes,
    unmodifiedPixels:result.after.profile.raisedPixels===result.before.profile.raisedPixels};
  records.push(record);
  console.log('OIL_ADAPTIVE '+JSON.stringify(record));
  if(!record.outputIdentical||!record.geometrySame||
    !record.unmodifiedPixels||mustCache!==record.rowsEnabled||
    rowCacheBytes>80000)valid=false;
 }
 if(errors.length){console.log('BROWSER_ERRORS '+JSON.stringify(errors));valid=false}
}finally{
 await writeFile(dir+'/results.json',JSON.stringify({valid,records,
   note:'Original and experimental ALGO/ART painter, 3 warmed timing samples; early CI data.'},null,2));
 await browser.close();
}
assert(valid,'Adaptive Oil lighting changed pixels or mis-selected a cache');
console.log('PASS: adaptive oil lighting is exact, preview-safe, and bounded to 80 KB');
