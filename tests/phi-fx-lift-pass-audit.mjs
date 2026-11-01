// Focused one-floor diagnostic. Real architectural postprocessing, original
// shaders/textures, no automatic lowering of visual quality.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const base='http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
const reports=[];
try{
 for(const [label,fx,earlycompile] of [['architectural-baseline','architectural',0],['early-shader-precompile','architectural',1]]){
  const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',err=>errors.push(String(err)));
  const report={label,fx,status:'failed'};
  try{
   const query=new URLSearchParams({fx,debug:1,liftprofile:1,
    liftbatch:16,liftstage:1,roomcull:1,framebatch:1,captionbatch:1,roombatch:0,earlycompile});
   await page.goto(base+'?'+query,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__galleryStartupError||!document.querySelector('#enter')?.disabled,null,{timeout:180000});
   const err=await page.evaluate(()=>window.__galleryStartupError||null);
   if(err)throw Error('startup: '+err);
   await page.locator('#enter').evaluate(e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,null,{timeout:30000});
   await page.locator('#openLift').evaluate(e=>e.click());
   await page.locator('#liftMonth').evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));},'2026-10');
   const button=page.locator('#liftDays button[title^="2026-10-20"]');
   await button.getAttribute('title',{timeout:15000});
   await button.evaluate(e=>e.click());
   await page.waitForFunction(()=>window.__phiLiftRide?.status==='opening'||window.__phiLiftError,null,{timeout:190000});
   const audit=await page.evaluate(()=>{
    const p=window.__phiLiftProfile?.visits?.at(-1);
    return {ride:window.__phiLiftRide,error:window.__phiLiftError||null,
     postfx:{preset:window.__phiPostFX?.preset,active:window.__phiPostFX?.active,
      renderer:window.__phiPostFX?.renderer},
     totalMs:p?.summary?.ms,
     p95Gap:p?.frames?.map(f=>f.deltaMs).sort((a,b)=>a-b)[Math.floor((p?.frames?.length||1)*.95)]||null,
     stages:p?.stages,operations:p?.operations,topSpikes:p?.operationSpikes,
     painting:window.__phiFullEngine,liftPrep:window.__phiLiftPreparation,
     earlyCompile:window.__phiEarlyShaderCompile||null};
   });
   Object.assign(report,{status:audit.error?'failed':'complete',audit,errors});
   console.log('FX_LIFT_PROFILE '+JSON.stringify({label,
    postfx:audit.postfx,earlyCompile:audit.earlyCompile,totalMs:audit.totalMs,p95Gap:audit.p95Gap,
    operations:audit.operations,spikes:audit.topSpikes,errors,error:audit.error}));
  }catch(e){report.error=String(e);report.errors=errors;
   console.error('FX_LIFT_FAILURE '+JSON.stringify({label,error:report.error,errors}));}
  reports.push(report);await page.close();
 }
 await mkdir('phi-fx-lift-audit',{recursive:true});
 await writeFile('phi-fx-lift-audit/results.json',JSON.stringify({date:'2026-10-20',
  environment:'Chromium SwiftShader; relative only',reports},null,2));
 if(reports.some(r=>r.status!=='complete'))process.exitCode=1;
}finally{await browser.close()}
