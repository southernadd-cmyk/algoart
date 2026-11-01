// One matched TEST-only A/B screen. Do not promote based on one SwiftShader pair.
// All original painting maps, architectural post-FX, shadow settings, and floor layout.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const results=[];
try{
 for(const [mode,portalbatch] of [['baseline',0],['portal-batch',1]]){
  const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  await page.addInitScript(()=>{
   window.__portalBatchFrames=[];let last=0;
   function sample(now){
    if(window.__phiLiftProfile?.active){
     if(last)window.__portalBatchFrames.push(+(now-last).toFixed(1));
     last=now;
    }else last=0;
    requestAnimationFrame(sample);
   }
   requestAnimationFrame(sample);
  });
  const r={mode,portalbatch,status:'failed'};
  try{
   const query=new URLSearchParams({
    debug:1,fx:'architectural',liftprofile:1,liftbatch:16,liftstage:1,
    roomcull:1,framebatch:1,captionbatch:1,roombatch:0,
    revealcompile:0,earlycompile:0,shadowreceiverfast:0,portalbatch
   });
   await page.goto('http://127.0.0.1:4173/test/virtual-gallery/full-engine.html?'+query,
    {waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__galleryStartupError||
    !document.querySelector('#enter')?.disabled,null,{timeout:180000});
   const error=await page.evaluate(()=>window.__galleryStartupError||null);
   if(error)throw Error('Startup '+error);
   await page.locator('#enter').evaluate(e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,null,{timeout:30000});
   await page.locator('#openLift').evaluate(e=>e.click());
   await page.locator('#liftMonth').evaluate((e,date)=>{
    e.value=date;e.dispatchEvent(new Event('change',{bubbles:true}));
   },'2026-10');
   const button=page.locator('#liftDays button[title^="2026-10-20"]');
   await button.getAttribute('title',{timeout:15000});
   await button.evaluate(e=>e.click());
   await page.waitForFunction(()=>window.__phiLiftRide?.status==='opening'||window.__phiLiftError,
    null,{timeout:210000});
   const data=await page.evaluate(()=>{
    const p=window.__phiLiftProfile?.visits?.at(-1);
    const stages=p?.stages||[],at=name=>stages.find(s=>s.name===name)?.elapsedMs??null;
    const frames=(window.__portalBatchFrames||[]).filter(Number.isFinite).sort((a,b)=>a-b);
    const pct=q=>frames.length?frames[Math.min(frames.length-1,Math.ceil(frames.length*q)-1)]:null;
    return {error:window.__phiLiftError||null,
     totalMs:p?.summary?.ms||null,
     arrivalMs:at('ride-finished')!==null&&at('doors-opening')!==null
      ?at('doors-opening')-at('ride-finished'):null,
     frames:{count:frames.length,p95:pct(.95),max:frames.at(-1)??null,
      over100:frames.filter(x=>x>100).length},
     scene:p?.operations?.['postfx-pass:0:scene-render']||null,
     shadows:p?.operations?.['shadow-map-render']||null,
     portal:window.__phiPortalFrameBatches||null,
     artwork:{expected:window.__phiFullEngine?.paintings,loaded:window.__phiFullEngine?.paintingsLoaded},
     postfx:{preset:window.__phiPostFX?.preset,active:window.__phiPostFX?.active,renderer:window.__phiPostFX?.renderer},
     frameBatches:window.__phiFrameBatches||null,captionBatches:window.__phiCaptionBatches||null
    };
   });
   Object.assign(r,data,{errors});
   if(data.error)throw Error('Lift '+data.error);
   if(!data.artwork.expected||data.artwork.expected!==data.artwork.loaded)
    throw Error('Painting readiness mismatch');
   if(data.postfx.preset!=='architectural'||!data.postfx.active||data.postfx.renderer!=='pmndrs')
    throw Error('Original architectural postprocessing not active');
   if(!data.portal||data.portal.active!==!!portalbatch)
    throw Error('Portal batch flag ignored '+JSON.stringify(data.portal));
   if(portalbatch&&!(data.portal.savedDrawCalls>0))
    throw Error('No useful portal draw-call reduction '+JSON.stringify(data.portal));
   if(errors.length)throw Error('Page errors '+errors.join('; '));
   r.status='complete';
   console.log('PHI_PORTAL_BATCH_TRIAL '+JSON.stringify({
    mode,status:r.status,totalMs:r.totalMs,arrivalMs:r.arrivalMs,
    frames:r.frames,scene:r.scene,shadows:r.shadows,portal:r.portal,artwork:r.artwork
   }));
  }catch(error){
   r.failure=String(error);
   console.error('PHI_PORTAL_BATCH_FAILURE '+JSON.stringify({mode,failure:r.failure,errors}));
  }finally{results.push(r);await page.close();}
 }
 const parity={artwork:JSON.stringify(results[0].artwork)===JSON.stringify(results[1].artwork),
  fx:JSON.stringify(results[0].postfx)===JSON.stringify(results[1].postfx),
  frameBatch:JSON.stringify(results[0].frameBatches)===JSON.stringify(results[1].frameBatches),
  captionBatch:JSON.stringify(results[0].captionBatches)===JSON.stringify(results[1].captionBatches)};
 await mkdir('phi-portal-batch-screen',{recursive:true});
 await writeFile('phi-portal-batch-screen/results.json',JSON.stringify({
  version:1,environment:'GitHub Actions Chromium SwiftShader; relative comparison only',
  date:'2026-10-20',note:'Single A/B screen; not sufficient for production recommendation',
  results,parity
 },null,2));
 console.log('PHI_PORTAL_BATCH_SUMMARY '+JSON.stringify({
  statuses:results.map(r=>r.status),parity,
  saved:results[1].portal?.savedDrawCalls,
  totalMs:results.map(r=>r.totalMs),arrivalMs:results.map(r=>r.arrivalMs),
  worstFrameMs:results.map(r=>r.frames?.max),p95:results.map(r=>r.frames?.p95),
  sceneTotalMs:results.map(r=>r.scene?.totalMs)
 }));
 if(results.some(r=>r.status!=='complete')||Object.values(parity).some(v=>!v))process.exitCode=1;
}finally{await browser.close();}
