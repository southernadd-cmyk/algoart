// TEST-only matched six-journey cross-over on two original archive editions.
// A single pair is noisy; do not treat SwiftShader timings as hardware FPS.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const base='http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
const results=[];
try{
 const trials=[['2026-10-20',0],['2026-10-20',1],
  ['2026-10-30',1],['2026-10-30',0],
  ['2026-10-20',1],['2026-10-20',0]];
 for(const [index,[date,fast]] of trials.entries()){
  const mode=fast?'receiver-only':'control';
  const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  await page.addInitScript(()=>{
   window.__phiAllFrameIntervals=[];
   let last=0;
   function sample(now){
    if(window.__phiLiftProfile?.active){
     if(last)window.__phiAllFrameIntervals.push(+(now-last).toFixed(1));
     last=now;
    }else last=0;
    requestAnimationFrame(sample);
   }
   requestAnimationFrame(sample);
  });
  const data={index:index+1,date,mode,fast,status:'failed'};
  try{
   const query=new URLSearchParams({
    fx:'architectural',debug:1,liftprofile:1,liftbatch:16,liftstage:1,
    roomcull:1,framebatch:1,captionbatch:1,roombatch:0,earlycompile:0,
    shadowreceiverfast:fast
   });
   await page.goto(base+'?'+query,{waitUntil:'domcontentloaded',timeout:65000});
   await page.waitForFunction(()=>window.__galleryStartupError||!document.querySelector('#enter')?.disabled,
    null,{timeout:180000});
   const error=await page.evaluate(()=>window.__galleryStartupError||null);
   if(error)throw Error('startup: '+error);
   await page.locator('#enter').evaluate(e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,null,{timeout:40000});
   await page.locator('#openLift').evaluate(e=>e.click());
   await page.locator('#liftMonth').evaluate((e,value)=>{
    e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));
   },date.slice(0,7));
   const target=page.locator('#liftDays button[title^="'+date+'"]');
   await target.getAttribute('title',{timeout:15000});
   await target.evaluate(e=>e.click());
   await page.waitForFunction(()=>window.__phiLiftRide?.status==='opening'||window.__phiLiftError,
    null,{timeout:210000});
   const audit=await page.evaluate(()=>{
    const p=window.__phiLiftProfile?.visits?.at(-1);
    const stages=p?.stages||[],at=n=>stages.find(x=>x.name===n)?.elapsedMs??null;
    const frames=(window.__phiAllFrameIntervals||[]).filter(Number.isFinite).sort((a,b)=>a-b);
    const percentile=n=>frames.length?frames[Math.min(frames.length-1,Math.ceil(frames.length*n)-1)]:null;
    return {error:window.__phiLiftError||null,ride:window.__phiLiftRide||null,
     totalMs:p?.summary?.ms??null,
     afterRideMs:at('doors-opening')===null||at('ride-finished')===null
      ?null:at('doors-opening')-at('ride-finished'),
     frames:{count:frames.length,p50Ms:percentile(.5),p95Ms:percentile(.95),
      maxMs:frames.at(-1)??null,over50:frames.filter(x=>x>50).length,
      over100:frames.filter(x=>x>100).length},
     scene:p?.operations?.['postfx-pass:0:scene-render']||null,
     shadows:p?.operations?.['shadow-map-render']||null,
     postfx:window.__phiPostFX?{
      preset:window.__phiPostFX.preset,active:window.__phiPostFX.active,
      renderer:window.__phiPostFX.renderer
     }:null,
     lighting:window.__phiLightingStudy?{...window.__phiLightingStudy}:null,
     paintings:window.__phiFullEngine?{
      loaded:window.__phiFullEngine.paintingsLoaded,
      total:window.__phiFullEngine.paintings
     }:null,
     renderer:window.__phiRenderStats?{...window.__phiRenderStats}:null,
     stageNames:stages.map(x=>x.name)};
   });
   Object.assign(data,audit,{errors});
   if(audit.error)throw Error('lift: '+audit.error);
   if(audit.postfx?.preset!=='architectural'||!audit.postfx?.active)
    throw Error('architectural postFX missing');
   if(!audit.paintings?.total||audit.paintings.loaded!==audit.paintings.total)
    throw Error('painting readiness failed');
   if(!!audit.lighting?.skipReceiverMaterialInvalidation!==!!fast)
    throw Error('receiver toggle did not match experiment');
   if(errors.length)throw Error('browser errors: '+errors.join('; '));
   data.status='complete';
   // Evidence images from the actual tower are useful for human inspection,
   // but moving time-based art means they are not suitable for exact-pixel CI.
   if(index<4){
    try{
     await page.waitForFunction(()=>window.__phiLiftState?.doorClosure<.015,
      null,{timeout:30000});
     await mkdir('phi-shadow-receiver-audit',{recursive:true});
     await page.locator('#world').screenshot({
      path:'phi-shadow-receiver-audit/gallery-'+date+'-'+mode+'.png',
      timeout:35000});
     data.screenshot='gallery-'+date+'-'+mode+'.png';
    }catch(error){data.screenshotError=String(error);}
   }
   console.log('PHI_RECEIVER_TRIAL '+JSON.stringify({
    index:data.index,date,mode,status:data.status,totalMs:data.totalMs,afterRideMs:data.afterRideMs,
    frames:data.frames,scene:data.scene,shadows:data.shadows,
    lighting:data.lighting,paintings:data.paintings,postfx:data.postfx,
    renderer:data.renderer,errors:data.errors
   }));
  }catch(error){
   data.failure=String(error);
   console.error('PHI_RECEIVER_FAILURE '+JSON.stringify({index:data.index,date,mode,error:data.failure,errors}));
  }finally{results.push(data);await page.close();}
 }
 const success=results.filter(r=>r.status==='complete');
 const byDate={};
 for(const trial of success){
  const target=byDate[trial.date]??={control:[],experimental:[]};
  target[trial.fast?'experimental':'control'].push(trial);
 }
 const describe=rows=>{
  const get=fn=>{
   const list=rows.map(fn).filter(Number.isFinite).sort((a,b)=>a-b);
   if(!list.length)return null;
   return {n:list.length,min:list[0],median:list[Math.floor((list.length-1)/2)],
    max:list.at(-1),mean:+(list.reduce((a,b)=>a+b,0)/list.length).toFixed(1)};
  };
  return {n:rows.length,
   journeyMs:get(x=>x.totalMs),arrivalMs:get(x=>x.afterRideMs),
   worstFrameMs:get(x=>x.frames?.maxMs),p95FrameMs:get(x=>x.frames?.p95Ms),
   over100:get(x=>x.frames?.over100),
   sceneTotalMs:get(x=>x.scene?.totalMs),sceneMaxMs:get(x=>x.scene?.maxMs),
   shadowTotalMs:get(x=>x.shadows?.totalMs),
   materialInvalidations:get(x=>x.lighting?.receiverMaterialInvalidations)};
 };
 const groupSummaries=Object.fromEntries(Object.entries(byDate).map(([date,groups])=>[
  date,{control:describe(groups.control),experimental:describe(groups.experimental)}
 ]));
 const checks={
  allSucceeded:results.length===trials.length&&success.length===trials.length,
  paintingsComplete:success.every(r=>r.paintings?.total>0&&r.paintings.loaded===r.paintings.total),
  postFXPreserved:success.every(r=>r.postfx?.active&&r.postfx?.preset==='architectural'
   &&r.postfx?.renderer==='pmndrs'),
  shadowCountsConsistent:Object.values(byDate).every(g=>{
   const all=[...g.control,...g.experimental];
   return all.every(r=>r.lighting?.casters===all[0]?.lighting?.casters
    &&r.lighting?.shadowMaps===all[0]?.lighting?.shadowMaps);
  }),
  receiverSwitch:success.every(r=>
   r.lighting?.skipReceiverMaterialInvalidation===!!r.fast),
  eachModeEachDate:Object.values(byDate).every(g=>g.control.length>0&&g.experimental.length>0)
 };
 const comparison={
  version:2,environment:'GitHub Actions Chromium SwiftShader software GPU; relative only',
  note:'Six cross-over trials; original architectural renderer. Real gallery screenshots are documentary, not pixel-comparable due to time-based installations. See deterministic fixture for exact pixel check.',
  schedule:trials.map(([date,fast])=>({date,mode:fast?'receiver-only':'control'})),
  results,checks,groupSummaries};
 await mkdir('phi-shadow-receiver-audit',{recursive:true});
 await writeFile('phi-shadow-receiver-audit/results.json',JSON.stringify(comparison,null,2));
 console.log('PHI_RECEIVER_CROSSOVER '+JSON.stringify({checks,groupSummaries,
  trials:results.map(r=>({i:r.index,date:r.date,mode:r.mode,status:r.status,
   totalMs:r.totalMs,arrivalMs:r.afterRideMs,worstMs:r.frames?.maxMs,
   screenshot:r.screenshot||null}))}));
 if(Object.values(checks).some(v=>!v))process.exitCode=1;
}finally{await browser.close();}
