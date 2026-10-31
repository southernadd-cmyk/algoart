// Browser A/B benchmark of the deployed TEST tower, never the live renderer.
// Runs in GitHub Actions with Chromium/SwiftShader: relative software GPU only.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const out='phi-ktx2-benchmark-results';
await mkdir(out,{recursive:true});
const base='https://southernadd-cmyk.github.io/algoart/test/virtual-gallery/full-engine.html';
const cases=['jpeg','ktx2','ktx2','jpeg'];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const percentile=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];
const summarise=values=>{
 const ordered=values.filter(x=>Number.isFinite(x)).sort((a,b)=>a-b);
 return ordered.length?{
  count:ordered.length,median:+percentile(ordered,.5).toFixed(2),
  p95:+percentile(ordered,.95).toFixed(2),
  max:+ordered.at(-1).toFixed(2),over50:ordered.filter(x=>x>50).length,
  over100:ordered.filter(x=>x>100).length,estimatedFps:+(1000/percentile(ordered,.5)).toFixed(1)
 }:null;
};
const results=[];
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
try{
 for(let i=0;i<cases.length;i++){
  const mode=cases[i];
  const context=await browser.newContext({viewport:{width:1100,height:700},deviceScaleFactor:1,
   reducedMotion:'no-preference',locale:'en-GB',timezoneId:'Europe/London'});
  const page=await context.newPage();
  const pageErrors=[],textureRequests=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('response',resp=>{
   if(/Bricks055_NormalGL\.(jpg|ktx2)|basis_transcoder\.(js|wasm)/.test(resp.url())){
    textureRequests.push({url:new URL(resp.url()).pathname.split('/').at(-1),
      status:resp.status(),bytes:Number(resp.headers()['content-length'])||null});
   }
  });
  await page.addInitScript(()=>{
   window.__ktxBench={frames:[],collecting:false};
   let last=0;
   const tick=t=>{
    if(window.__ktxBench?.collecting && last && !document.hidden)
     window.__ktxBench.frames.push(t-last);
    last=t;
    requestAnimationFrame(tick);
   };
   requestAnimationFrame(tick);
  });
  const start=Date.now();
  const url=new URL(base);
  url.searchParams.set('debug','1'); // expose existing frame diagnostics
  if(mode==='ktx2')url.searchParams.set('ktx2','1');
  let state='unknown',entryMs=null,pilot=null,metrics=null,error=null;
  try{
   await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:55000});
   await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled||
    !!window.__galleryStartupError,{timeout:85000});
   entryMs=Date.now()-start;
   const entryState=await page.evaluate(()=>({
    enabled:!document.querySelector('#enter')?.disabled,
    startupError:window.__galleryStartupError||null
   }));
   if(!entryState.enabled)throw new Error('Gallery failed to start: '+entryState.startupError);
   await page.waitForFunction(()=>window.__phiKTX2Pilot &&
     (window.__phiKTX2Pilot.status==='loaded'||window.__phiKTX2Pilot.status==='fallback-jpg'||
      window.__phiKTX2Pilot.status==='off'),{timeout:60000});
   pilot=await page.evaluate(()=>window.__phiKTX2Pilot);
   if(mode==='ktx2'&&pilot.status!=='loaded'){
    throw new Error('KTX2 failed to load: '+JSON.stringify(pilot));
   }
   await page.locator('#enter').press('Enter');
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,{timeout:10000});
   await page.waitForTimeout(2200); // shaders/uploads settle before sampling
   await page.evaluate(()=>{window.__ktxBench.frames=[];window.__ktxBench.collecting=true;});
   // Same camera motion in all sessions: walk forward, then look right.
   await page.keyboard.down('w');await page.waitForTimeout(1800);await page.keyboard.up('w');
   await page.keyboard.down('ArrowRight');await page.waitForTimeout(1000);await page.keyboard.up('ArrowRight');
   await page.waitForTimeout(7200);
   metrics=await page.evaluate(()=>{
    window.__ktxBench.collecting=false;
    return {
     frameMs:window.__ktxBench.frames,
     perf:window.__phiPerformance?{
      medianFrameMs:window.__phiPerformance.medianFrameMs,
      p95FrameMs:window.__phiPerformance.p95FrameMs,
      fps:window.__phiPerformance.fps,
      drawCalls:window.__phiPerformance.drawCalls,
      triangles:window.__phiPerformance.triangles,
      textures:window.__phiPerformance.textures
     }:null,
     geometry:window.__phiRenderStats||null,
     art:window.__phiFullEngine||null,
     lighting:window.__phiLightingStudy||null,
     startupError:window.__galleryStartupError||null,
     usedHeapBytes:performance.memory?.usedJSHeapSize||null
    };
   });
   state='complete';
   await page.screenshot({path:`${out}/${i+1}-${mode}.png`});
  }catch(e){
   state='failed';error=String(e?.message||e);
   try{pilot=await page.evaluate(()=>window.__phiKTX2Pilot||null);}catch{}
   try{await page.screenshot({path:`${out}/${i+1}-${mode}-error.png`});}catch{}
  }
  const entry={
   iteration:i+1,mode,state,error,readyMs:entryMs,pilot,
   frameSummary:metrics?summarise(metrics.frameMs):null,
   renderer:metrics?.perf||null,
   gpuResourceCounts:metrics?.geometry||null,
   usedHeapBytes:metrics?.usedHeapBytes||null,
   textureRequests,
   startupError:metrics?.startupError||null,
   pageErrors:pageErrors.slice(0,15)
  };
  results.push(entry);
  console.log('BENCH_RESULT '+JSON.stringify(entry));
  await context.close();
  await sleep(1200);
 }
 const aggregate={};
 for(const mode of ['jpeg','ktx2']){
  const good=results.filter(x=>x.mode===mode&&x.state==='complete');
  aggregate[mode]={
   runs:good.length,
   readyMs:good.map(x=>x.readyMs),
   frameMedianMs:good.map(x=>x.frameSummary?.median),
   frameP95Ms:good.map(x=>x.frameSummary?.p95),
   framesOver50:good.map(x=>x.frameSummary?.over50),
   drawCalls:good.map(x=>x.renderer?.drawCalls),
   rendererTextures:good.map(x=>x.renderer?.textures),
   statuses:results.filter(x=>x.mode===mode).map(x=>x.pilot?.status||x.error)
  };
 }
 const report={
  environment:'GitHub Actions ubuntu-latest / headless Chromium / SwiftShader software WebGL',
  scope:'test gallery, Bricks055 brick normal map only; 1100x700 DPR 1',
  sequence:cases,steadySampleDurationMs:10000,aggregate,results
 };
 await writeFile(`${out}/results.json`,JSON.stringify(report,null,2));
 console.log('BENCH_SUMMARY '+JSON.stringify(aggregate));
 if(results.some(x=>x.state==='failed'))process.exitCode=1;
}finally{await browser.close();}
