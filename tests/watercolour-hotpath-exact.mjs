// Exact-RGBA and isolated speed comparison of two independent paper-preparation
// optimisations. Both variants retain all source geometry and quality passes.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(180000);
  await page.goto('http://127.0.0.1:4173/?v=9&seed=PAPER-HOTPATH-BASE&mode=organic&material=watercolour-v2s',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.AlgoArt?.renderWatercolourV2S==='function');
  const results=await page.evaluate(()=>{
    const A=window.AlgoArt,base=A.readSettings();
    const variants=[
      {name:'baseline',scratch:false,skipLog:false},
      {name:'scratch',scratch:true,skipLog:false},
      {name:'skip-log',scratch:false,skipLog:true},
      {name:'combined',scratch:true,skipLog:true}
    ];
    const modes=['organic','rects','network','burst'],results=[];
    function render(settings,scale,variant){
      A.watercolourScratchPaperExperimental=variant.scratch;
      A.watercolourSkipZeroDensityLogExperimental=variant.skipLog;
      const canvas=document.createElement('canvas'),start=performance.now();
      A.renderWatercolourV2S(canvas,settings,scale,false);
      const ms=performance.now()-start,bytes=canvas.getContext('2d')
        .getImageData(0,0,canvas.width,canvas.height).data;
      return {ms,bytes,width:canvas.width,height:canvas.height};
    }
    const median=xs=>{const a=[...xs].sort((a,b)=>a-b);return (a[1]+a[2])/2};
    try{
      for(const [i,mode] of modes.entries())for(const scale of [.42,1]){
        const settings={...base,seed:'HOTPATH-'+mode+'-'+scale,
          mode,orientation:i%2?'portrait':'landscape'};
        const timings=Object.fromEntries(variants.map(v=>[v.name,[]]));
        let exact=true,firstDifference=-1;
        for(const v of variants)render(settings,scale,v);
        for(let repetition=0;repetition<4;repetition++){
          const control=render(settings,scale,variants[0]);
          timings.baseline.push(control.ms);
          const order=repetition%2?[variants[3],variants[2],variants[1]]:variants.slice(1);
          for(const variant of order){
            const trial=render(settings,scale,variant);
            timings[variant.name].push(trial.ms);
            if(control.width!==trial.width||control.height!==trial.height)exact=false;
            else for(let k=0;k<control.bytes.length;k++)if(control.bytes[k]!==trial.bytes[k]){
              if(firstDifference===-1)firstDifference=k;
              exact=false;break;
            }
          }
        }
        results.push({mode,scale,exact,firstDifference,
          baselineMs:median(timings.baseline),
          scratchMs:median(timings.scratch),
          skipLogMs:median(timings['skip-log']),
          combinedMs:median(timings.combined)});
      }
    }finally{
      delete A.watercolourScratchPaperExperimental;
      delete A.watercolourSkipZeroDensityLogExperimental;
    }
    return results;
  });
  for(const item of results){
    console.log('WATERCOLOUR_HOTPATH_CASE '+JSON.stringify(item));
    assert.equal(item.exact,true,'RGBA mismatch: '+item.mode+' '+item.scale+' @ '+item.firstDifference);
  }
  const totals={baseline:0,scratch:0,skipLog:0,combined:0};
  for(const row of results){
    totals.baseline+=row.baselineMs;totals.scratch+=row.scratchMs;
    totals.skipLog+=row.skipLogMs;totals.combined+=row.combinedMs;
  }
  const pct=key=>+((totals.baseline-totals[key])/totals.baseline*100).toFixed(2);
  console.log('WATERCOLOUR_HOTPATH_SUMMARY '+JSON.stringify({
    cases:results.length,exactRGBA:results.every(x=>x.exact),
    totalBaselineMs:+totals.baseline.toFixed(1),
    improvementPct:{scratch:pct('scratch'),skipLog:pct('skipLog'),combined:pct('combined')},
    fasterCases:{
      scratch:results.filter(x=>x.scratchMs<x.baselineMs).length,
      skipLog:results.filter(x=>x.skipLogMs<x.baselineMs).length,
      combined:results.filter(x=>x.combinedMs<x.baselineMs).length
    }
  }));
}finally{await browser.close();}
