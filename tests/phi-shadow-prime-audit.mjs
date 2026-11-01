// Matched, TEST-only lift-arrival shadow timing A/B study.
// Uses unchanged architectural post-FX, artwork, shadow map quality and lighting.
// Chromium SwiftShader is useful for comparative diagnosis, not user FPS estimates.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const base='http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
const trials=[
 {date:'2026-10-20',shadowprime:0},
 {date:'2026-10-20',shadowprime:1},
 {date:'2026-10-30',shadowprime:1},
 {date:'2026-10-30',shadowprime:0},
 {date:'2026-10-20',shadowprime:1},
 {date:'2026-10-20',shadowprime:0}
];
const reports=[];
const stats=values=>{
 const a=values.filter(Number.isFinite).sort((a,b)=>a-b);
 if(!a.length)return null;
 return {n:a.length,min:a[0],median:a[Math.floor(a.length/2)],
  p95:a[Math.min(a.length-1,Math.ceil(a.length*.95)-1)],max:a.at(-1),
  over50:a.filter(x=>x>50).length,over100:a.filter(x=>x>100).length};
};
try{
 for(const [index,trial] of trials.entries()){
  const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
   window.__shadowFrames=[];
   let last=null;
   function measure(now){
    if(window.__phiLiftProfile?.active){
     if(last!==null){window.__shadowFrames.push(+(now-last).toFixed(1));
      if(window.__shadowFrames.length>15000)window.__shadowFrames.shift();}
     last=now;
    }else last=null;
    requestAnimationFrame(measure);
   }
   requestAnimationFrame(measure);
  });
  const report={index:index+1,...trial,label:trial.shadowprime?'shadow-prime':'control',status:'failed'};
  try{
   const query=new URLSearchParams({
    fx:'architectural',debug:1,liftprofile:1,liftbatch:16,liftstage:1,
    roomcull:1,framebatch:1,captionbatch:1,roombatch:0,
    earlycompile:0,shadowprime:trial.shadowprime
   });
   await page.goto(base+'?'+query,{waitUntil:'domcontentloaded',timeout:65000});
   await page.waitForFunction(()=>window.__galleryStartupError||
    !document.querySelector('#enter')?.disabled,null,{timeout:180000});
   const startup=await page.evaluate(()=>window.__galleryStartupError||null);
   if(startup)throw Error('startup '+startup);
   await page.locator('#enter').evaluate(e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,
    null,{timeout:40000});
   await page.locator('#openLift').evaluate(e=>e.click());
   await page.locator('#liftMonth').evaluate((e,value)=>{
    e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));
   },trial.date.slice(0,7));
   const button=page.locator('#liftDays button[title^="'+trial.date+'"]');
   await button.getAttribute('title',{timeout:18000});
   await button.evaluate(e=>e.click());
   await page.waitForFunction(()=>window.__phiLiftRide?.status==='opening'||
    window.__phiLiftError,null,{timeout:220000});
   const result=await page.evaluate(()=>{
    const p=window.__phiLiftProfile?.visits?.at(-1);
    const stages=p?.stages||[];
    const stage=name=>stages.find(s=>s.name===name)?.elapsedMs??null;
    const op=name=>p?.operations?.[name]??null;
    const frames=[...(window.__shadowFrames||[])].sort((a,b)=>a-b);
    const quantile=q=>frames.length?frames[Math.min(frames.length-1,Math.ceil(q*frames.length)-1)]:null;
    return {
     error:window.__phiLiftError||null,ride:window.__phiLiftRide||null,
     totalMs:p?.summary?.ms??null,
     arrivalToDoorsMs:stage('ride-finished')===null||stage('doors-opening')===null
      ?null:stage('doors-opening')-stage('ride-finished'),
     frame:{n:frames.length,p50:quantile(.5),p95:quantile(.95),
      max:frames.at(-1)??null,
      over50:frames.filter(x=>x>=50).length,
      over100:frames.filter(x=>x>=100).length},
     shadow:op('shadow-map-render'),scene:op('postfx-pass:0:scene-render'),
     postfx:op('postfx-composer-total'),
     prime:window.__phiShadowPrime||null,
     lighting:window.__phiLightingStudy||null,
     postfxState:{preset:window.__phiPostFX?.preset,
      active:window.__phiPostFX?.active,
      renderer:window.__phiPostFX?.renderer},
     paintings:{loaded:window.__phiFullEngine?.paintingsLoaded,
      expected:window.__phiFullEngine?.paintings},
     stageNames:stages.map(x=>x.name),
     topSpikes:p?.operationSpikes?.slice(0,8)||[]
    };
   });
   Object.assign(report,result,{errors});
   if(result.error)throw Error('lift error: '+result.error);
   if(result.postfxState?.preset!=='architectural'||!result.postfxState?.active)
    throw Error('architectural postFX missing');
   if(!result.paintings?.expected||result.paintings?.expected!==result.paintings?.loaded)
    throw Error('paintings incomplete');
   if(trial.shadowprime&&(!result.prime?.success||!result.prime.lights))
    throw Error('shadow priming unavailable: '+JSON.stringify(result.prime));
   if(errors.length)throw Error('page errors: '+errors.join('; '));
   report.status='complete';
   console.log('SHADOW_PRIME_TRIAL '+JSON.stringify({index:report.index,date:trial.date,
    mode:report.label,totalMs:report.totalMs,arrivalToDoorsMs:report.arrivalToDoorsMs,
    frame:report.frame,shadow:report.shadow,scene:report.scene,
    prime:report.prime,paintings:report.paintings,status:report.status}));
  }catch(error){
   report.status='failed';report.failure=String(error);
   console.error('SHADOW_PRIME_FAILURE '+JSON.stringify({index:report.index,
    date:trial.date,mode:report.label,error:report.failure,errors}));
  }finally{
   reports.push(report);
   await page.close();
  }
 }
 const byDate={};
 for(const trial of reports){
  if(trial.status!=='complete')continue;
  const b=byDate[trial.date]??={control:[],shadowPrime:[]};
  b[trial.shadowprime?'shadowPrime':'control'].push(trial);
 }
 const comparisons=Object.entries(byDate).map(([date,b])=>{
  const summarize=a=>({
   samples:a.length,
   totalMs:stats(a.map(r=>r.totalMs)),
   arrivalToDoorsMs:stats(a.map(r=>r.arrivalToDoorsMs)),
   worstFrameMs:stats(a.map(r=>r.frame.max)),
   frameP95Ms:stats(a.map(r=>r.frame.p95)),
   shadowTotalMs:stats(a.map(r=>r.shadow?.totalMs)),
   sceneTotalMs:stats(a.map(r=>r.scene?.totalMs))
  });
  return {date,control:summarize(b.control),shadowPrime:summarize(b.shadowPrime)};
 });
 const output={version:1,environment:'Chromium Ubuntu SwiftShader software WebGL; relative only',
  settings:'architectural postFX, original paintings, 16-mesh reveal, earlycompile=0, original lighting',
  trials:reports,comparisons};
 await mkdir('phi-shadow-prime-audit',{recursive:true});
 await writeFile('phi-shadow-prime-audit/results.json',JSON.stringify(output,null,2));
 console.log('SHADOW_PRIME_SUMMARY '+JSON.stringify(comparisons));
 if(reports.some(r=>r.status!=='complete'))process.exitCode=1;
}finally{await browser.close();}
