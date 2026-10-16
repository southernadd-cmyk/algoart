// Compare frozen main with candidate in one Chromium session.
// Alternating order and warm-ups minimise JIT and first-render bias.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const base=process.env.MATERIAL_BASE_SHA||'9acbaff7b64a1b1e04c2415bd1ade4b9072e5e5d';
const original=execFileSync('git',['show',base+':js/watercolour-v2s.js'],{encoding:'utf8',maxBuffer:4*1024*1024});
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  page.setDefaultTimeout(180000);
  await page.goto(root+'?v=9&seed=PERF-REFERENCE-001&mode=organic&material=watercolour-v2s',
    {waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>typeof window.AlgoArt?.renderWatercolourV2S==='function');
  const modes=['organic','rects','network','spiral','field','burst','geometric','scribble'];
  const candidates=modes.flatMap((mode,i)=>[
    {seed:'PERF-BENCH-'+String(i+1).padStart(2,'0')+'-L',mode,orientation:'landscape'},
    {seed:'PERF-BENCH-'+String(i+1).padStart(2,'0')+'-P',mode,orientation:'portrait'}
  ]);
  const results=await page.evaluate(({original,candidates})=>{
    const A=window.AlgoArt,optimised=A.renderWatercolourV2S,baseSettings=A.readSettings();
    (0,eval)(original);
    const historical=A.renderWatercolourV2S;
    const median=a=>{const s=[...a].sort((x,y)=>x-y);return (s[(s.length-1)>>1]+s[s.length>>1])/2};
    const render=(fn,settings)=>{
      const canvas=document.createElement('canvas'),start=performance.now();
      fn(canvas,settings,.42,false);
      const ms=performance.now()-start;
      const ctx=canvas.getContext('2d');
      return {width:canvas.width,height:canvas.height,
        pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data,ms};
    };
    const output=[];
    try{
      for(const test of candidates){
        const settings={...baseSettings,...test};
        // Warm up both implementations for this composition.
        render(historical,settings);render(optimised,settings);
        const baseline=[],candidate=[];let differences=0,pixels=0;
        for(let repetition=0;repetition<6;repetition++){
          const first=repetition%2===0?historical:optimised;
          const second=repetition%2===0?optimised:historical;
          const a=render(first,settings),b=render(second,settings);
          const before=repetition%2===0?a:b,after=repetition%2===0?b:a;
          baseline.push(before.ms);candidate.push(after.ms);
          pixels=before.width*before.height;
          if(before.width!==after.width||before.height!==after.height)differences=-1;
          else if(differences>=0){
            for(let i=0;i<before.pixels.length;i++)
              if(before.pixels[i]!==after.pixels[i])differences++;
          }
        }
        const baselineMedianMs=median(baseline),optimisedMedianMs=median(candidate);
        output.push({...test,pixels,differences,baselineMedianMs,optimisedMedianMs,
          changePct:+((baselineMedianMs-optimisedMedianMs)/baselineMedianMs*100).toFixed(1),
          baselineSamplesMs:baseline.map(x=>+x.toFixed(2)),
          optimisedSamplesMs:candidate.map(x=>+x.toFixed(2))});
      }
    }finally{A.renderWatercolourV2S=optimised;}
    return output;
  },{original,candidates});
  for(const item of results)assert.equal(item.differences,0,
    'Watercolour pixels changed for '+item.seed);
  const wins=results.filter(x=>x.changePct>0).length;
  const median=a=>{let s=[...a].sort((x,y)=>x-y);return (s[(s.length-1)>>1]+s[s.length>>1])/2};
  const summary={cases:results.length,runsPerRendererPerCase:6,exactPixelMatches:results.length,
    fasterCases:wins,slowerCases:results.length-wins,
    medianCaseChangePct:median(results.map(x=>x.changePct)),
    baselineMedianTotalMs:results.reduce((n,x)=>n+x.baselineMedianMs,0),
    optimisedMedianTotalMs:results.reduce((n,x)=>n+x.optimisedMedianMs,0)};
  console.log('PASS watercolour expanded RGBA parity and benchmarks');
  console.log('BENCHMARK_SUMMARY '+JSON.stringify(summary));
  console.log('BENCHMARK_CASES '+JSON.stringify(results));
} finally {await browser.close();}
