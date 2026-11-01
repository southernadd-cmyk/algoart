// TEST-only two-trial screening A/B: same edition, original settings/artwork.
// Does NOT assert performance from one pair or claim pixel identity.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const base='http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
const results=[];
try{
 for(const [mode,fast] of [['control',0],['receiver-only',1]]){
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
  const data={mode,fast,status:'failed'};
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
   },'2026-10');
   const date=page.locator('#liftDays button[title^="2026-10-20"]');
   await date.getAttribute('title',{timeout:15000});
   await date.evaluate(e=>e.click());
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
   console.log('PHI_RECEIVER_TRIAL '+JSON.stringify({
    mode,status:data.status,totalMs:data.totalMs,afterRideMs:data.afterRideMs,
    frames:data.frames,scene:data.scene,shadows:data.shadows,
    lighting:data.lighting,paintings:data.paintings,postfx:data.postfx,
    renderer:data.renderer,errors:data.errors
   }));
  }catch(error){
   data.failure=String(error);
   console.error('PHI_RECEIVER_FAILURE '+JSON.stringify({mode,error:data.failure,errors}));
  }finally{results.push(data);await page.close();}
 }
 const control=results[0],fast=results[1];
 const differences=['receivers','casters'].map(key=>[
  key,control.lighting?.[key],fast.lighting?.[key]]);
 const visualState={paintingsMatch:control.paintings?.loaded===fast.paintings?.loaded
   &&control.paintings?.total===fast.paintings?.total,
  sameLightAndShadowCounts:control.lighting?.roomLight!=null&&fast.lighting?.roomLight!=null
   &&control.lighting?.shadowMaps===fast.lighting?.shadowMaps
   &&control.lighting?.casters===fast.lighting?.casters,
  samePostFX:JSON.stringify(control.postfx)===JSON.stringify(fast.postfx),
  rendererMemory:{control:control.renderer,fast:fast.renderer}};
 const comparison={date:'2026-10-20',environment:'GitHub Actions Chromium SwiftShader, relative only',
  note:'Screening only: single A/B pair is not sufficient to establish a performance benefit or pixel identity.',
  results,visualState,differences};
 await mkdir('phi-shadow-receiver-audit',{recursive:true});
 await writeFile('phi-shadow-receiver-audit/results.json',JSON.stringify(comparison,null,2));
 console.log('PHI_RECEIVER_SUMMARY '+JSON.stringify({
  controls:[control.status,fast.status],visualState,
  totalMs:[control.totalMs,fast.totalMs],afterRideMs:[control.afterRideMs,fast.afterRideMs],
  worstFrameMs:[control.frames?.maxMs,fast.frames?.maxMs],
  p95Ms:[control.frames?.p95Ms,fast.frames?.p95Ms],
  materialInvalidations:[control.lighting?.receiverMaterialInvalidations,
   fast.lighting?.receiverMaterialInvalidations]}));
 if(results.some(x=>x.status!=='complete')||!visualState.paintingsMatch||
    !visualState.sameLightAndShadowCounts||!visualState.samePostFX)
  process.exitCode=1;
}finally{await browser.close();}
