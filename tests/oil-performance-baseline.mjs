// Oil v2 Stage A/B: real ALGO/ART image-equivalence and speed baseline.
// V1 is never modified on main. The shared-capture path is test-only.
// Run with a local server, e.g. python3 -m http.server 4173.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const output=process.env.OIL_BENCH_OUTPUT||'oil-performance-results';
await mkdir(output,{recursive:true});
const cases=[
 {mode:'organic',orientation:'landscape',seed:'OIL-PERF-ORGANIC-01'},
 {mode:'rects',orientation:'portrait',seed:'OIL-PERF-RECTS-02'},
 {mode:'network',orientation:'landscape',seed:'OIL-PERF-NETWORK-03'},
 {mode:'burst',orientation:'portrait',seed:'OIL-PERF-BURST-04'}
];
const scale=.45;
const browser=await chromium.launch({headless:true});
const results=[];
let allEquivalent=true,allCallsReduced=true;
try{
 const page=await browser.newPage({viewport:{width:1450,height:960}});
 page.setDefaultTimeout(120000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?v=9&seed=OIL-PERF-INIT&mode=organic&material=oil-v1',
   {waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV1==='function');
 for(const spec of cases){
  const record=await page.evaluate(({spec,scale})=>{
   const A=window.AlgoArt;
   const settings={...A.readSettings(),...spec,
     palette:'golden',colourCount:8,saturation:86,brightness:55,
     density:67,elements:48,complexity:65,negativeSpace:52};
   const actualRender=A.render;
   const run=(reuse,encode=true)=>{
    let sourceCalls=0,sourceMs=0;
    A.oilPerfExperimental=reuse;
    A.render=function(...args){
      sourceCalls++;
      const start=performance.now();
      try{return actualRender.apply(this,args)}
      finally{sourceMs+=performance.now()-start}
    };
    let artwork,canvas;
    try{
      canvas=document.createElement('canvas');
      const t0=performance.now();
      artwork=A.renderOilPaintV1(canvas,settings,scale,false);
      const ms=performance.now()-t0;
      const height=A.lastOilPaintV4EStats?.height||{};
      const phases=A.lastOilPaintV4EStats?.phases||{};
      const output={ms:+ms.toFixed(2),sourceMs:+sourceMs.toFixed(2),
        sourceCalls,phases,dimensions:[canvas.width,canvas.height],
        colourFields:artwork.work.oilV1?.broadFields||0,
        bristleContacts:A.lastOilPaintV4EStats?.bristleContacts||0,
        heightActivePixels:height.heightActivePixels||0,
        version:artwork.version,renderMs:artwork.renderMs};
      if(encode)output.png=canvas.toDataURL('image/png');
      return output;
    }finally{
      A.render=actualRender;
      A.oilPerfExperimental=false;
    }
   };
   // Warm both code paths before measuring; the optimisation is opt-in only.
   run(false,false);run(true,false);
   const baseline=run(false),candidate=run(true);
   const repeatedBaseline=run(false,false);
   const repeatedCandidate=run(true,false);
   return {
     baseline,candidate,
     stableBaselineMs:+((baseline.ms+repeatedBaseline.ms)/2).toFixed(2),
     stableCandidateMs:+((candidate.ms+repeatedCandidate.ms)/2).toFixed(2),
     pixelsIdentical:baseline.png===candidate.png
   };
  },{spec,scale});
  const name=spec.mode+'-'+spec.orientation;
  const asBytes=url=>Buffer.from(url.slice(url.indexOf(',')+1),'base64');
  await writeFile(output+'/'+name+'-oil-v1.png',asBytes(record.baseline.png));
  await writeFile(output+'/'+name+'-oil-v2-shared-capture.png',asBytes(record.candidate.png));
  const result={name,scale,dimensions:record.baseline.dimensions,
    pixelsIdentical:record.pixelsIdentical,
    sourceRendersBefore:record.baseline.sourceCalls,
    sourceRendersAfter:record.candidate.sourceCalls,
    sourceMsBefore:record.baseline.sourceMs,
    sourceMsAfter:record.candidate.sourceMs,
    baselineMs:record.stableBaselineMs,
    experimentalMs:record.stableCandidateMs,
    gainPct:+((record.stableBaselineMs-record.stableCandidateMs)/
      record.stableBaselineMs*100).toFixed(1),
    baselinePhases:record.baseline.phases,
    candidatePhases:record.candidate.phases,
    baselinePaintedPixels:record.baseline.heightActivePixels,
    candidatePaintedPixels:record.candidate.heightActivePixels,
    colourFields:record.baseline.colourFields};
  results.push(result);
  if(!record.pixelsIdentical)allEquivalent=false;
  if(record.candidate.sourceCalls!==1||
     record.baseline.sourceCalls!==2)allCallsReduced=false;
  console.log('OIL_PERF_CASE '+JSON.stringify(result));
 }
 if(errors.length)throw Error('Page errors: '+errors.join('; '));
}finally{
 await writeFile(output+'/results.json',JSON.stringify({
  branch:'experiment/oil-v2-performance-baseline',
  scale,results,allEquivalent,allCallsReduced,
  explanation:'Time measurements are local to the CI runner; performance is not a production guarantee.'
 },null,2));
 await browser.close();
}
assert(allEquivalent,'Optimised capture changed Oil v1 pixels; review the saved images');
assert(allCallsReduced,'Expected source captures to fall from two to one per render');
console.log('PASS: unchanged genuine ALGO/ART Oil pixels, and two source captures reduced to one');
