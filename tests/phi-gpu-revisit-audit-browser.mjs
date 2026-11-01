// A/B-ready test tower revisit audit. No geometry, texture, shader or renderer
// settings are changed. Only explicit renderer.initTexture calls are instrumented;
// implicit WebGL uploads are represented by scene warmup and renderer.info.
// SwiftShader is software WebGL: these are relative CI observations, not GPU FPS.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
const destinations=['2026-10-20','2026-10-30','2026-10-20'];
const round=x=>Number.isFinite(x)?Math.round(x*10)/10:null;
const percentile=(numbers,p)=>numbers.length?[...numbers].sort((a,b)=>a-b)[Math.floor((numbers.length-1)*p)]:null;
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const results=[],errors=[],resourceWarnings=[];
const reuseUploads=process.env.PHI_GPU_REVISIT_REUSE==='1';
let startup=null;
const context=await browser.newContext({viewport:{width:1200,height:760},
 deviceScaleFactor:1,locale:'en-GB',timezoneId:'Europe/London'});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{
 if(message.type()!=='error')return;
 const line=message.text();
 if(line.includes('Failed to load resource: the server responded with a status of 404'))
  resourceWarnings.push('optional missing asset: '+line.slice(0,180));
 else errors.push('console: '+line.slice(0,200));
});
page.on('response',response=>{
 if(response.status()===404)resourceWarnings.push('404 '+response.url());
});
await page.addInitScript(()=>{
 const b=window.__gpuRevisitFrames={active:false,frames:[],last:null};
 function track(t){
  if(b.active&&b.last!==null)b.frames.push({ms:t-b.last,stage:window.__phiLiftRide?.status||'unknown'});
  b.last=t;requestAnimationFrame(track);
 }requestAnimationFrame(track);
});
const snapshot=async()=>page.evaluate(()=>window.__phiGpuVisitAudit?.snapshot()||null);
try{
 const url=new URL(base);
 for(const [name,value] of Object.entries({
  debug:1,liftprofile:1,gpuvisitbench:1,liftstage:1,liftbatch:16,
  captionbatch:1,framebatch:1,roomcull:1,roombatch:0,liftreuse:reuseUploads?1:0
 }))url.searchParams.set(name,String(value));
 const started=Date.now();
 await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled||!!window.__galleryStartupError,
  null,{timeout:180000});
 const error=await page.evaluate(()=>window.__galleryStartupError||null);
 if(error)throw Error('Startup failed: '+error);
 startup={ms:Date.now()-started,resources:await snapshot()};
 await page.locator('#enter').evaluate(e=>e.click());
 await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,
  null,{timeout:20000});
 await page.waitForTimeout(650);
 startup.afterEntry=await snapshot();
 for(const [index,date] of destinations.entries()){
  const before=await snapshot();
  await page.locator('#openLift').evaluate(e=>e.click());
  await page.waitForFunction(()=>document.querySelector('#lift')?.hidden===false,
   null,{timeout:20000});
  await page.locator('#liftMonth').evaluate((element,month)=>{
   element.value=month;element.dispatchEvent(new Event('change',{bubbles:true}));
  },date.slice(0,7));
  const button=page.locator('#liftDays button[title^="'+date+'"]');
  const name=await button.getAttribute('title',{timeout:18000});
  const floor=Number(name?.match(/floor (\d+)/)?.[1]);
  if(!Number.isFinite(floor))throw Error('No floor for '+date+': '+name);
  await page.evaluate(()=>{
   const frames=window.__gpuRevisitFrames;
   frames.frames=[];frames.last=null;frames.active=true;
  });
  const tripStart=Date.now();
  await button.evaluate(e=>e.click());
  await page.waitForFunction(target=>
   window.__phiLiftRide?.status==='opening'&&
   !window.__phiLiftState?.travelling &&
   window.__phiLiftState?.floor===target || !!window.__phiLiftError,
   floor,{timeout:190000});
  const travel=await page.evaluate(()=>{
   const frames=window.__gpuRevisitFrames;
   frames.active=false;
   const visit=window.__phiLiftProfile?.visits?.at(-1)||null;
   return {ride:window.__phiLiftRide,profile:visit,frames:frames.frames,
    failure:window.__phiLiftError||null};
  });
  if(travel.failure)throw Error('Lift failed '+JSON.stringify(travel.failure));
  await page.waitForTimeout(500);
  const after=await snapshot();
  const frameMs=travel.frames.map(x=>x.ms).filter(x=>x>0&&Number.isFinite(x));
  const worst=travel.frames.filter(x=>x.ms>=100).sort((a,b)=>b.ms-a.ms).slice(0,8);
  const stages=travel.profile?.stages||[];
  const stage=k=>stages.find(s=>s.name===k)?.elapsedMs??null;
  const stageDelta=(a,b)=>stage(a)==null||stage(b)==null?null:
   round(stage(b)-stage(a));
  const resourcesDiff=Object.fromEntries([
   'geometries','textures','shaderPrograms','explicitUploadCalls',
   'distinctExplicitTextures','repeatedTextureCalls','disposeEvents'
  ].map(k=>[k,(after?.[k]??0)-(before?.[k]??0)]));
  const record={
   visit:index+1,date,repeat:index===2,floor,wallClockMs:Date.now()-tripStart,
   loaded:after?.paintingsLoaded,expected:after?.paintings,
   resourcesBefore:before,resourcesAfter:after,resourceDelta:resourcesDiff,
   measuredFrames:frameMs.length,frameP50Ms:round(percentile(frameMs,.5)),
   frameP95Ms:round(percentile(frameMs,.95)),
   frameMaxMs:round(Math.max(...frameMs,0)),
   stallsOver100ms:frameMs.filter(n=>n>=100).length,topStalls:worst,
   sceneBuildMs:stageDelta('ride-finished','floor-construction-finished'),
   paintingWaitMs:stageDelta('paintings-waiting','paintings-gpu-ready'),
   arrivalToDoorsMs:stageDelta('ride-finished','doors-opening'),
   completedProfile:travel.profile?.summary||null,
   profileOperationSpikes:travel.profile?.operationSpikes?.slice(0,8)||[],
   stages:stages.map(x=>({name:x.name,at:x.elapsedMs,details:x.details||null})).filter(x=>
    ['ride-finished','floor-construction-finished','paintings-gpu-ready',
     'texture-upload-and-compile-finished','doors-opening'].includes(x.name))
  };
  results.push(record);
  console.log('GPU_REVISIT_RESULT '+JSON.stringify({
   visit:record.visit,date:record.date,revisit:record.repeat,
   expected:record.expected,loaded:record.loaded,
   frameP95Ms:record.frameP95Ms,frameMaxMs:record.frameMaxMs,
   stallsOver100ms:record.stallsOver100ms,
   sceneBuildMs:record.sceneBuildMs,paintingWaitMs:record.paintingWaitMs,
   arrivalToDoorsMs:record.arrivalToDoorsMs,
   delta:record.resourceDelta,
   memory:record.resourcesAfter&&{
    textures:record.resourcesAfter.textures,
    geometries:record.resourcesAfter.geometries,shaderPrograms:record.resourcesAfter.shaderPrograms
   },gpuPrep:record.resourcesAfter?.paintingGPU
  }));
  if(record.expected!==record.loaded||!record.expected)
   throw Error('Painting readiness mismatch at '+date);
  if(index<destinations.length-1)await page.waitForTimeout(1100);
 }
} catch(error){
 errors.push('BENCHMARK_FAILURE '+String(error));
 console.error('GPU_REVISIT_FAILURE '+String(error));
 process.exitCode=1;
} finally{
 await mkdir('phi-gpu-revisit-audit',{recursive:true});
 const report={environment:'GitHub Actions Chromium SwiftShader software WebGL',
  method:'Three consecutive lift rides 20 Oct → 30 Oct → 20 Oct in one browser; painting interlock retained',
  reuseUploads,resourceWarnings,
  limitations:'renderer.info counts are live resources, not GPU byte usage; explicit upload counts exclude implicit uploads; software rendering is not representative GPU FPS.',
  startup,results,errors};
 await writeFile('phi-gpu-revisit-audit/results.json',JSON.stringify(report,null,2));
 console.log('GPU_REVISIT_SUMMARY '+JSON.stringify({
  visited:results.length,dates:destinations,reuseUploads,errors,resourceWarnings,
  memory:results.map(r=>({date:r.date,geometries:r.resourcesAfter?.geometries,
   textures:r.resourcesAfter?.textures,programs:r.resourcesAfter?.shaderPrograms,
   prepared:r.resourcesAfter?.paintingGPU?.prepared,uploaded:r.resourcesAfter?.paintingGPU?.uploaded})),
  frameP95:results.map(r=>r.frameP95Ms),
  maxStalls:results.map(r=>r.frameMaxMs)
 }));
 await context.close();await browser.close();
 if(results.length!==destinations.length||results.some(r=>r.loaded!==r.expected)||errors.length)
  process.exitCode=1;
}
