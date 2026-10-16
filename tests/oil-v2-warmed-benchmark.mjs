// Warmed, same-browser-context comparison of the genuine ALGO/ART oil renderers.
// Keeps V1 and V2 in separate pages: loading V2's experimental core overrides
// brush functions in its own page and must never contaminate the V1 baseline.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='oil-v2-preview-results';
await mkdir(out,{recursive:true});
const cases=[
 {mode:'organic',orientation:'landscape',seed:'OIL-V2-MULTICOLOUR-01',palette:'golden',colourCount:8,saturation:86,brightness:55},
 {mode:'rects',orientation:'portrait',seed:'OIL-V2-MULTICOLOUR-02',palette:'golden',colourCount:8,saturation:86,brightness:55},
 {mode:'network',orientation:'landscape',seed:'OIL-V2-MULTICOLOUR-03',palette:'golden',colourCount:8,saturation:86,brightness:55},
 {mode:'burst',orientation:'portrait',seed:'OIL-V2-MULTICOLOUR-04',palette:'golden',colourCount:8,saturation:86,brightness:55}
];
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
const round=n=>+n.toFixed(2);
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1450,height:1000}});
 const v1=await context.newPage(),v2=await context.newPage();
 v1.setDefaultTimeout(180000);v2.setDefaultTimeout(180000);
 const startup=root+'?v=9&seed=OIL-V2-TEST-01&mode=organic&material=oil-v1';
 await Promise.all([v1.goto(startup,{waitUntil:'domcontentloaded'}),
                    v2.goto(startup,{waitUntil:'domcontentloaded'})]);
 await Promise.all([v1,v2].map(p=>p.waitForFunction(
   ()=>typeof window.AlgoArt?.renderOilPaintV1==='function')));
 await v2.evaluate(()=>{
   const A=window.AlgoArt;
   window.__oilBenchPlanner={
     planCompositionV5:A.planCompositionV5,
     captureCompositionV5:A.captureCompositionV5,
     planCompositionV5FromSource:A.planCompositionV5FromSource
   };
 });
 await v2.addScriptTag({url:new URL('js/oil-v2-core-a.js',root).href});
 await v2.evaluate(()=>{
   Object.assign(window.AlgoArt,window.__oilBenchPlanner);
   delete window.__oilBenchPlanner;
 });
 await v2.addScriptTag({url:new URL('js/oil-paint-v2.js',root).href});
 assert(await v2.evaluate(()=>typeof window.AlgoArt.renderOilPaintV2==='function'));

 async function measure(page,spec,version){
   return page.evaluate(({spec,version})=>{
     const A=window.AlgoArt;
     const render=version===1?A.renderOilPaintV1:A.renderOilPaintV2;
     const settings={...A.readSettings(),...spec};
     const durations=[],phases=[],dimensions=[];
     let firstPNG=null,lastPNG=null,stats;
     // Two warm-ups and seven measured renders, interleaved by case/page.
     for(let iteration=0;iteration<9;iteration++){
       const canvas=document.createElement('canvas');
       const started=performance.now();
       stats=render(canvas,settings,.75,false);
       const elapsed=performance.now()-started;
       if(iteration>=2){
         durations.push(elapsed);
         phases.push({...A.lastOilPaintV4EStats?.phases});
         dimensions.push([canvas.width,canvas.height]);
         if(iteration===2)firstPNG=canvas.toDataURL('image/png');
         if(iteration===8)lastPNG=canvas.toDataURL('image/png');
       }
     }
     return {
       durations,phases,dimensions,
       deterministic:firstPNG===lastPNG,
       version:stats.version,
       sourcePaths:A.lastOilPaintV4EStats?.sourcePaths,
       paintedPaths:A.lastOilPaintV4EStats?.paintedPaths,
       filaments:stats.work?.oilV2?.visibleFineFilaments??null
     };
   },{spec,version});
 }
 const rows=[];
 for(const [index,spec] of cases.entries()){
   // Alternate which version is measured first to mitigate warming bias.
   const order=index%2?[['v2',v2,2],['v1',v1,1]]:
                       [['v1',v1,1],['v2',v2,2]];
   const values={};
   for(const [name,page,version] of order)
     values[name]=await measure(page,spec,version);
   for(const name of ['v1','v2']){
     const v=values[name];
     assert(v.deterministic,name+' pixels changed across repeats');
     assert(v.dimensions.every(d=>d.join(',')===v.dimensions[0].join(',')),
       name+' canvas dimensions changed');
     assert(v.durations.length===7&&v.durations.every(Number.isFinite));
   }
   assert.deepEqual(values.v1.dimensions[0],values.v2.dimensions[0]);
   const phases={};
   for(const name of ['v1','v2']){
     phases[name]={};
     for(const key of ['captureMs','planMs','paintMs','reliefMs','totalMs'])
       phases[name][key]=round(median(values[name].phases.map(p=>p[key]??0)));
   }
   const baseline=median(values.v1.durations),trial=median(values.v2.durations);
   const row={
     name:spec.mode+'-'+spec.orientation,
     seed:spec.seed,
     pixels:values.v1.dimensions[0],
     v1MedianMs:round(baseline),v2MedianMs:round(trial),
     overheadPct:round((trial/baseline-1)*100),
     v1RunsMs:values.v1.durations.map(round),
     v2RunsMs:values.v2.durations.map(round),
     phases,
     sourcePaths:values.v1.sourcePaths,
     paintedPaths:values.v1.paintedPaths,
     filamentCount:values.v2.filaments
   };
   rows.push(row);
   console.log('WARMED OIL V1 vs V2',JSON.stringify(row));
 }
 const summary={
   benchmark:'oil-v2-v4-warmed',rendersPerVersionPerCase:9,
   warmups:2,measurements:7,scale:.75,
   cases:rows,
   medianCaseOverheadPct:round(median(rows.map(r=>r.overheadPct)))
 };
 await writeFile(out+'/warmed-timings.json',JSON.stringify(summary,null,2));
 console.log('WARMED OIL SUMMARY',JSON.stringify({
   medianCaseOverheadPct:summary.medianCaseOverheadPct,
   measurements:summary.measurements,
   cases:rows.map(r=>({name:r.name,overheadPct:r.overheadPct}))
 }));
 await context.close();
}finally{await browser.close()}
