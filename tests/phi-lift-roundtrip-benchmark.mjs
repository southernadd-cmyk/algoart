// Automated G -> latest floor -> G lift performance comparison.
// CI uses software WebGL: useful for relative stalls and stage attribution,
// NOT a measurement of frame rate on the visitor's GPU or headset.
import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';

const BASE=process.env.PHI_TEST_SERVER||'http://127.0.0.1:4173';
const OUTPUT='phi-lift-roundtrip-results';
const cases=[
 {label:'current-overlap',query:'liftoverlap=1'},
 {label:'legacy-no-overlap',query:'liftoverlap=0'}
];
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const round=x=>Number.isFinite(x)?+x.toFixed(1):null;
const quantile=(values,q)=>{
 if(!values.length)return null;
 const a=[...values].sort((x,y)=>x-y);
 return round(a[Math.min(a.length-1,Math.floor((a.length-1)*q))]);
};
function segment(profile){
 const stages=profile?.stages||[];
 const out={};
 for(let i=1;i<stages.length;i++){
  const p=stages[i-1],s=stages[i];
  out[p.name+' -> '+s.name]=round(s.at-p.at);
 }
 return out;
}
async function measure(mode){
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{
  const b=window.__roundtripBench={active:false,frames:[],longTasks:[],last:0};
  try{
   new PerformanceObserver(list=>{
    for(const entry of list.getEntries()){
     if(b.active)b.longTasks.push({at:entry.startTime,ms:entry.duration});
    }
   }).observe({entryTypes:['longtask']});
  }catch{}
  function tick(t){
   if(b.active&&b.last>0){
    const lift=window.__phiLiftRide;
    const profile=window.__phiLiftProfile?.visits?.at(-1);
    b.frames.push({at:t,ms:t-b.last,ride:lift?.status||'unknown',
     progress:lift?.progress??null,stage:profile?.stages?.at(-1)?.name||'unknown'});
   }
   b.last=t;
   requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
 });
 const result={mode:mode.label,query:mode.query,environment:'GitHub Actions Chromium SwiftShader (software WebGL)',journeys:[],errors};
 try{
  const start=Date.now();
  await page.goto(BASE+'/gallery/visit/?debug=1&liftprofile=1&'+mode.query,
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled||!!window.__galleryStartupError,
   null,{timeout:200000});
  const startup=await page.evaluate(()=>window.__galleryStartupError||null);
  if(startup)throw new Error('Startup failed: '+startup);
  result.startupMs=Date.now()-start;
  await page.locator('#enter').evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,
   null,{timeout:30000});
  const archive=await page.evaluate(async()=>{
   const response=await fetch('../archive.json',{cache:'no-store'});
   if(!response.ok)throw Error('Archive request '+response.status);
   const json=await response.json();
   return [...new Set((json.days||[]).map(x=>x.date).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))].sort();
  });
  const latest=archive.at(-1);
  const topFloor=archive.length-1;
  if(!latest||topFloor<1)throw Error('No top-floor archive date');
  result.destination={date:latest,floor:topFloor};
  const jobs=[
   {direction:'reception-to-top',date:latest,floor:topFloor},
   {direction:'top-to-reception',date:'__phi_reception__',floor:0}
  ];
  for(const job of jobs){
   await page.locator('#openLift').evaluate(el=>el.click());
   await page.waitForFunction(()=>document.querySelector('#lift')?.hidden===false,
    null,{timeout:30000});
   await page.evaluate(()=>{
    const b=window.__roundtripBench;
    b.frames=[];b.longTasks=[];b.active=true;b.last=performance.now();
   });
   const before=await page.evaluate(()=>performance.now());
   if(job.floor===0){
    await page.locator('#liftReception').evaluate(el=>el.click());
   }else{
    await page.locator('#liftMonth').evaluate((el,month)=>{
     el.value=month;el.dispatchEvent(new Event('change',{bubbles:true}));
    },job.date.slice(0,7));
    const button=page.locator('#liftDays button[title^="'+job.date+'"]');
    const title=await button.getAttribute('title',{timeout:15000});
    const numbered=Number(title?.match(/floor (\d+)/)?.[1]);
    if(numbered!==job.floor)throw Error('Top floor mismatch: '+title+'; expected '+job.floor);
    await button.evaluate(el=>el.click());
   }
   await page.waitForFunction(({floor,date})=>{
    const state=window.__phiLiftState,ride=window.__phiLiftRide;
    return (ride?.status==='ready'&&state?.floor===floor&&
     state?.date===date&&!state?.travelling)||!!window.__phiLiftError;
   },job,{timeout:220000});
   const after=await page.evaluate(()=>{
    const b=window.__roundtripBench;b.active=false;
    return {now:performance.now(),frames:b.frames,longTasks:b.longTasks,
     profile:window.__phiLiftProfile?.visits?.at(-1)||null,
     state:window.__phiLiftState,ride:window.__phiLiftRide,
     gate:window.__phiLiftPreparation?.paintings||null,
     gallery:window.__phiFullEngine||null,
     error:window.__phiLiftError||null};
   });
   const durations=after.frames.map(f=>f.ms);
   const worst=[...after.frames].sort((a,b)=>b.ms-a.ms).slice(0,12)
    .map(({at,ms,ride,progress,stage})=>({
     elapsedMs:round(at-before),ms:round(ms),ride,progress:round(progress),stage
    }));
   const stages=after.profile?.stages||[];
   const at=name=>stages.find(x=>x.name===name)?.elapsedMs??null;
   const delta=(a,b)=>at(a)!=null&&at(b)!=null?round(at(b)-at(a)):null;
   const summary={
    mode:mode.label,direction:job.direction,date:job.date,floor:job.floor,
    success:!after.error&&after.ride?.status==='ready'&&after.state?.floor===job.floor,
    elapsedMs:round(after.now-before),frameCount:durations.length,
    frameP50Ms:quantile(durations,.5),frameP95Ms:quantile(durations,.95),
    largestFrameMs:round(Math.max(0,...durations)),
    framesOver50:durations.filter(ms=>ms>=50).length,
    framesOver80:durations.filter(ms=>ms>=80).length,
    framesOver100:durations.filter(ms=>ms>=100).length,
    framesOver250:durations.filter(ms=>ms>=250).length,
    worstFrames:worst,
    longTasks:after.longTasks.sort((a,b)=>b.ms-a.ms).slice(0,10)
     .map(x=>({elapsedMs:round(x.at-before),ms:round(x.ms)})),
    stageTimes:{
     selectToMetadataMs:at('edition-metadata-ready'),
     doorsClosingMs:delta('edition-metadata-ready','doors-closed'),
     metadataToBuildStartMs:delta('edition-metadata-ready','ride-construction-start'),
     constructionMs:delta('ride-construction-start','floor-construction-finished'),
     paintingGateMs:delta('paintings-waiting','paintings-gpu-ready'),
     revealMs:delta('scene-reveal-start','scene-reveal-finished'),
     postRevealPumpMs:delta('scene-reveal-finished','deferred-pump-finished'),
     warmupMs:delta('deferred-pump-finished','texture-upload-and-compile-finished'),
     remainingRideMs:delta('destination-ready-in-ride','ride-finished'),
     doorsOpenToReadyMs:null
    },
    stages:stages.map(({name,elapsedMs,details})=>({name,elapsedMs,details})),
    stageSegments:segment(after.profile),
    paintings:after.gallery?.paintingsLoaded,
    paintingsExpected:after.gallery?.paintings,
    paintingGate:after.gate,
    profileSummary:after.profile?.summary||null,
    failure:after.error
   };
   const opening=at('doors-opening');
   summary.stageTimes.doorsOpenToReadyMs=opening==null?null:round(after.now-(after.profile.start+opening));
   result.journeys.push(summary);
   console.log('LIFT_ROUNDTRIP_JOURNEY '+JSON.stringify({
    mode:mode.label,direction:job.direction,date:job.date,floor:job.floor,
    success:summary.success,elapsedMs:summary.elapsedMs,p50:summary.frameP50Ms,
    p95:summary.frameP95Ms,largest:summary.largestFrameMs,
    over100:summary.framesOver100,over250:summary.framesOver250,
    stages:summary.stageTimes,worst:summary.worstFrames.slice(0,7),
    error:summary.failure
   }));
   if(!summary.success)throw Error('Journey failed: '+JSON.stringify(after.error||after.ride));
   if(job.floor>0&&!summary.paintingsExpected)throw Error('No paintings at destination');
   if(job.floor>0&&summary.paintings!==summary.paintingsExpected)throw Error('Missing paintings');
  }
  result.status='passed';
 }catch(e){
  result.status='failed';result.error=String(e);
  console.error('LIFT_ROUNDTRIP_FAILURE '+mode.label+' '+String(e));
  try{await page.screenshot({path:OUTPUT+'/'+mode.label+'-failure.png'});}catch{}
 }finally{
  await writeFile(OUTPUT+'/'+mode.label+'.json',JSON.stringify(result,null,2));
  await context.close();
 }
 return result;
}
await mkdir(OUTPUT,{recursive:true});
const results=[];
try{
 for(const mode of cases)results.push(await measure(mode));
 const summary={
  environment:'CI SwiftShader software WebGL; compare timings only, not real hardware FPS',
  generatedAt:new Date().toISOString(),
  results:results.map(r=>({mode:r.mode,status:r.status,error:r.error||null,
   startupMs:r.startupMs,destination:r.destination,journeys:r.journeys.map(j=>({
    direction:j.direction,elapsedMs:j.elapsedMs,frameP50Ms:j.frameP50Ms,
    frameP95Ms:j.frameP95Ms,largestFrameMs:j.largestFrameMs,
    framesOver100:j.framesOver100,framesOver250:j.framesOver250,
    worstFrames:j.worstFrames.slice(0,10),stageTimes:j.stageTimes
   }))}))
 };
 await writeFile(OUTPUT+'/summary.json',JSON.stringify(summary,null,2));
 console.log('LIFT_ROUNDTRIP_SUMMARY '+JSON.stringify(summary));
 if(results.some(r=>r.status!=='passed'||r.journeys.length!==2))process.exitCode=1;
}finally{await browser.close()}
