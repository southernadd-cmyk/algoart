// Stage E oil adapter lighting-cache canary using genuine ALGO/ART output.
// Strictly opt-in; all source compositions and historical Oil v1 remain fixed.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const output='oil-stage-e-lighting-results';
await mkdir(output,{recursive:true});
const cases=[
 {mode:'organic',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-01',scale:.65},
 {mode:'rects',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-02',scale:.65},
 {mode:'network',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-03',scale:.65},
 {mode:'burst',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-04',scale:.65},
 {mode:'organic',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-01',scale:1},
 {mode:'rects',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-02',scale:1}
];
const browser=await chromium.launch({headless:true});
const results=[];
let success=true;
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'?v=9&seed=OIL-E-LIGHT&mode=organic&material=oil-v1',
    {waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV1==='function');
 await page.addScriptTag({url:new URL('js/oil-stage-c-brush.js',url).href});
 for(const spec of cases){
  const data=await page.evaluate(spec=>{
   const A=window.AlgoArt;
   const settings={...A.readSettings(),...spec,palette:'golden',
     colourCount:8,saturation:86,brightness:55,density:67,elements:48,
     complexity:65,negativeSpace:52};
   function run(mode,save=false){
     A.oilPerfExperimental=true;
     A.oilBrushPerfExperimental=true;
     A.oilStageCExperimental=true;
     A.oilStageDRefinement=true;A.oilStageCScale=spec.scale;
     A.oilStageECachedLightingExperimental=mode==='full';
     A.oilStageERollingLightingExperimental=mode==='rows';
     A.oilStageEAdapterProfile={};
     try{
       const canvas=document.createElement('canvas');
       const t=performance.now();
       const meta=A.renderOilPaintV1(canvas,settings,spec.scale,false);
       const ms=performance.now()-t;
       return {ms,phases:{...A.oilStageEAdapterProfile},
         geom:JSON.stringify({guide:meta.guide,voids:meta.voids,strategy:meta.strategy}),
         dims:[canvas.width,canvas.height],
         png:save?canvas.toDataURL('image/png'):null};
     }finally{
       A.oilPerfExperimental=false;A.oilBrushPerfExperimental=false;
       A.oilStageCExperimental=false;A.oilStageDRefinement=false;
       A.oilStageCScale=null;A.oilStageECachedLightingExperimental=false;
       A.oilStageERollingLightingExperimental=false;
       A.oilStageEAdapterProfile=null;
     }
   }
   run('normal');run('full');run('rows'); // warm all three
   const old=run('normal',true),full=run('full',true),test=run('rows',true);
   const oldTimes=[],fullTimes=[],newTimes=[];
   for(let i=0;i<3;i++){
     if(i%2===0){
       oldTimes.push(run('normal').ms);
       newTimes.push(run('rows').ms);
       fullTimes.push(run('full').ms);
     }else {
       fullTimes.push(run('full').ms);
       newTimes.push(run('rows').ms);
       oldTimes.push(run('normal').ms);
     }
   }
   oldTimes.sort((a,b)=>a-b);newTimes.sort((a,b)=>a-b);
   fullTimes.sort((a,b)=>a-b);
   return {old,test,full,oldMs:oldTimes[1],newMs:newTimes[1],
     fullMs:fullTimes[1],matches:old.png===test.png,
     fullMatches:old.png===full.png};
  },spec);
  const name=spec.mode+'-'+spec.orientation+'-'+String(spec.scale).replace('.','p');
  const toBytes=s=>Buffer.from(s.slice(s.indexOf(',')+1),'base64');
  await writeFile(output+'/'+name+'-stage-d.png',toBytes(data.old.png));
  await writeFile(output+'/'+name+'-cache.png',toBytes(data.test.png));
  const record={name,pixelIdentical:data.matches,
    fullCacheIdentical:data.fullMatches,
    geometryIdentical:data.old.geom===data.test.geom,
    dimensions:data.old.dims,baselineMs:+data.oldMs.toFixed(1),
    rollingMs:+data.newMs.toFixed(1),
    fullCachedMs:+data.fullMs.toFixed(1),
    gainPct:+((data.oldMs-data.newMs)*100/data.oldMs).toFixed(1),
    baselineAdapter:data.old.phases,
    fullCacheAdapter:data.full.phases,rollingAdapter:data.test.phases};
  results.push(record);
  console.log('OIL_LIGHTING '+JSON.stringify(record));
  if(!record.pixelIdentical||!record.fullCacheIdentical||
     !record.geometryIdentical||!record.rollingAdapter.extraHeightBytes)
    success=false;
 }
 if(errors.length){console.log('BROWSER_ERRORS '+JSON.stringify(errors));success=false}
}finally{
 await writeFile(output+'/results.json',JSON.stringify({
    success,results,explanation:'3 warm browser timings. Full-precision surface cache is an experiment and increases memory.'},null,2));
 await browser.close();
}
assert(success,'Lighting cache is NOT pixel-identical to existing Stage D');
console.log('PASS: rolling 7-row oil relief matches original and full-surface cache exactly');
