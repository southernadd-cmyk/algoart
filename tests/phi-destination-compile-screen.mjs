// Screening benchmark only. Same exact TEST tower + archived floor + postprocessing.
// Software WebGL absolute timings are not representative of visitor hardware.
// A/B differences need confirmation in reversed and repeated runs.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const reports=[];
const date='2026-10-20';
try{
 for(const [mode,revealcompile] of [['baseline',0],['full-destination-shader-compile',1]]){
  const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
   window.__compileScreenFrames=[];
   let last=0;
   function sample(now){
    if(window.__phiLiftProfile?.active){
     if(last)window.__compileScreenFrames.push(+(now-last).toFixed(1));
     last=now;
    }else last=0;
    requestAnimationFrame(sample);
   }
   requestAnimationFrame(sample);
  });
  const r={mode,date,status:'failed'};
  try{
   const qs=new URLSearchParams({
    debug:1,fx:'architectural',liftprofile:1,
    liftbatch:16,liftstage:1,roomcull:1,framebatch:1,captionbatch:1,
    roombatch:0,earlycompile:0,shadowreceiverfast:0,revealcompile
   });
   await page.goto('http://127.0.0.1:4173/test/virtual-gallery/full-engine.html?'+qs,
    {waitUntil:'domcontentloaded',timeout:65000});
   await page.waitForFunction(()=>window.__galleryStartupError||
    !document.querySelector('#enter')?.disabled,null,{timeout:180000});
   const startup=await page.evaluate(()=>window.__galleryStartupError||null);
   if(startup)throw Error('Startup '+startup);
   await page.locator('#enter').evaluate(e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,
    null,{timeout:30000});
   await page.locator('#openLift').evaluate(e=>e.click());
   await page.locator('#liftMonth').evaluate((e,m)=>{
    e.value=m;e.dispatchEvent(new Event('change',{bubbles:true}));
   },date.slice(0,7));
   const button=page.locator('#liftDays button[title^="'+date+'"]');
   await button.getAttribute('title',{timeout:15000});
   await button.evaluate(e=>e.click());
   await page.waitForFunction(()=>window.__phiLiftRide?.status==='opening'||window.__phiLiftError,
    null,{timeout:195000});
   const data=await page.evaluate(()=>{
    const p=window.__phiLiftProfile?.visits?.at(-1);
    const stages=p?.stages||[];
    const stage=name=>stages.find(s=>s.name===name)?.elapsedMs??null;
    const frames=(window.__compileScreenFrames||[]).filter(Number.isFinite).sort((a,b)=>a-b);
    const pct=x=>frames.length?frames[Math.min(frames.length-1,Math.ceil(frames.length*x)-1)]:null;
    const prepare=window.__phiRevealCompile||null;
    return {
     error:window.__phiLiftError||null,
     totalMs:p?.summary?.ms??null,
     arrivalToDoorMs:stage('ride-finished')!=null&&stage('doors-opening')!=null
       ?stage('doors-opening')-stage('ride-finished'):null,
     compile:prepare,
     frame:{count:frames.length,p95:pct(.95),max:frames.at(-1)??null,
      over100:frames.filter(v=>v>=100).length},
     sceneRender:p?.operations?.['postfx-pass:0:scene-render']||null,
     shadowRender:p?.operations?.['shadow-map-render']||null,
     postFX:{preset:window.__phiPostFX?.preset,
      active:window.__phiPostFX?.active,
      renderer:window.__phiPostFX?.renderer},
     paintings:{expected:window.__phiFullEngine?.paintings,
      loaded:window.__phiFullEngine?.paintingsLoaded},
     reveal:stages.find(s=>s.name==='scene-reveal-finished')?.details||null,
     stages:stages.map(s=>s.name)
    };
   });
   Object.assign(r,data,{errors});
   if(data.error)throw Error('Lift '+data.error);
   if(data.postFX.preset!=='architectural'||!data.postFX.active)
    throw Error('Post-processing parity failed');
   if(!data.paintings.expected||data.paintings.expected!==data.paintings.loaded)
    throw Error('Paintings not all ready');
   if(revealcompile&&(!data.compile?.attempted||!data.compile?.meshes||data.compile.error))
    throw Error('Destination precompile missing or failed '+JSON.stringify(data.compile));
   if(!revealcompile&&data.compile)throw Error('Control unexpectedly compiled');
   if(errors.length)throw Error('JS errors '+errors.join('; '));
   r.status='complete';
   console.log('DEST_COMPILE_RUN '+JSON.stringify({
    mode,date,status:r.status,totalMs:r.totalMs,arrivalToDoorMs:r.arrivalToDoorMs,
    frame:r.frame,sceneRender:r.sceneRender,shadowRender:r.shadowRender,
    compile:r.compile,paintings:r.paintings,errors:r.errors
   }));
  }catch(e){
   r.failure=String(e);
   console.error('DEST_COMPILE_FAILURE '+JSON.stringify({mode,date,error:r.failure,errors}));
  }finally{reports.push(r);await page.close();}
 }
 const summary={environment:'GitHub Actions Chromium SwiftShader; relative only',
  sameDate:date,mode:'screen; one A/B pair',reports};
 await mkdir('phi-destination-compile-screen',{recursive:true});
 await writeFile('phi-destination-compile-screen/results.json',JSON.stringify(summary,null,2));
 if(reports.some(r=>r.status!=='complete'))process.exitCode=1;
}finally{await browser.close();}
