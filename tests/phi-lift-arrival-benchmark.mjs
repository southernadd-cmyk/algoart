// On-runner Chromium software WebGL: comparative timing, NOT real GPU FPS.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const quantile=(a,q)=>a.length?[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor((a.length-1)*q))]:null;
const n=x=>typeof x==='number'?+x.toFixed(1):null;
const cases=[['live','gallery/visit/'],['test','test/virtual-gallery/full-engine.html']];
const destinations=['2026-10-20','2026-10-30'];
const results=[];
async function benchmark(label,path){
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.addInitScript(()=>{
  const b=window.__liftBenchmark={active:false,frames:[],last:0};
  function track(t){
   if(b.active&&b.last)b.frames.push({ms:t-b.last,phase:window.__phiLiftRide?.status||'unknown'});
   b.last=t;requestAnimationFrame(track);
  }requestAnimationFrame(track);
 });
 try{
  const started=Date.now();
  await page.goto('http://127.0.0.1:4173/'+path+'?debug=1&liftprofile=1',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled||!!window.__galleryStartupError,null,{timeout:185000});
  const error=await page.evaluate(()=>window.__galleryStartupError||'');
  if(error)throw Error('Startup error '+error);
  const startupMs=Date.now()-started;
  await page.locator('#enter').evaluate(e=>e.click());
  await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,null,{timeout:30000});
  const rides=[];
  for(const date of destinations){
   await page.locator('#openLift').evaluate(e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#lift')?.hidden===false,null,{timeout:20000});
   await page.locator('#liftMonth').evaluate((e,m)=>{e.value=m;e.dispatchEvent(new Event('change',{bubbles:true}));},date.slice(0,7));
   const button=page.locator('#liftDays button[title^="'+date+'"]');
   const title=await button.getAttribute('title',{timeout:18000});
   const floor=Number(title?.match(/floor (\d+)/)?.[1]);
   if(!Number.isFinite(floor))throw Error('Floor lookup failed '+date+': '+title);
   const before=await page.evaluate(()=>{const b=window.__liftBenchmark;b.frames=[];b.last=0;b.active=true;return performance.now()});
   await button.evaluate(e=>e.click());
   try{
    await page.waitForFunction(f=>window.__phiLiftState?.floor===f&&!window.__phiLiftState?.travelling&&window.__phiLiftRide?.status==='opening',floor,{timeout:140000});
   }catch(error){
    const info=await page.evaluate(()=>({lift:window.__phiLiftState,ride:window.__phiLiftRide,error:window.__phiLiftError,startup:window.__galleryStartupError}));
    throw Error('Ride failed '+date+' '+JSON.stringify(info)+' '+error);
   }
   const after=await page.evaluate(()=>{
    const b=window.__liftBenchmark;b.active=false;
    return {now:performance.now(),frames:b.frames,profile:window.__phiLiftProfile?.visits?.at(-1)||null,
     prep:window.__phiLiftPreparation||null,info:window.__phiFullEngine||null,
     error:window.__phiLiftError||null};
   });
   const frames=after.frames.map(x=>x.ms),stalls=after.frames.filter(x=>x.ms>=80);
   const stages=after.profile?.stages||[];
   const stage=k=>stages.find(x=>x.name===k)?.elapsedMs??null;
   const sceneStart=stage('ride-finished'),sceneEnd=stage('floor-construction-finished'),doorsOpen=stage('doors-opening');
   const record={label,date,floor,elapsedMs:n(after.now-before),frameCount:frames.length,
    frameP50Ms:n(quantile(frames,.5)),frameP95Ms:n(quantile(frames,.95)),maxFrameMs:n(Math.max(0,...frames)),
    stalls80:stalls.length,stalls100:stalls.filter(x=>x.ms>=100).length,
    topStalls:stalls.sort((a,b)=>b.ms-a.ms).slice(0,8).map(x=>({ms:n(x.ms),phase:x.phase})),
    sceneBuildMs:sceneStart==null||sceneEnd==null?null:n(sceneEnd-sceneStart),
    arrivalToDoorMs:sceneStart==null||doorsOpen==null?null:n(doorsOpen-sceneStart),
    loaded:after.info?.paintingsLoaded,total:after.info?.paintings,
    gpuPrep:after.prep?.paintingGPU||null,
    warmup:{compileMs:after.prep?.compileMs,uploadMs:after.prep?.uploadMs,totalMs:after.prep?.totalMs,
     failedUploads:after.prep?.failedUploads,timedOut:after.prep?.timedOut},
    stageNames:stages.map(x=>x.name),error:after.error};
   rides.push(record);console.log('LIFT_JOURNEY '+JSON.stringify(record));
  }
  return {label,startupMs,rides,jsErrors:errors};
 }finally{await context.close()}
}
try{
 for(const [label,path] of cases){
  try{results.push(await benchmark(label,path))}
  catch(error){results.push({label,error:String(error)});console.error('BENCHMARK_FAILURE '+label+' '+String(error))}
 }
 await mkdir('phi-benchmark-results',{recursive:true});
 const report={environment:'GitHub Actions Ubuntu Chromium SwiftShader (software GPU)',destinations,results};
 await writeFile('phi-benchmark-results/lift-benchmark.json',JSON.stringify(report,null,2));
 console.log('LIFT_BENCHMARK_SUMMARY '+JSON.stringify(report));
 if(results.some(x=>x.error||x.rides?.length!==destinations.length))process.exitCode=1;
}finally{await browser.close()}
