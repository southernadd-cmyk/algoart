// Isolated CI comparison. SwiftShader timings are not hardware GPU measurements.
import {chromium} from 'playwright';
import {mkdir,writeFile,appendFile} from 'node:fs/promises';
const out='lift-precompile-results';await mkdir(out,{recursive:true});
const results=[];
const cases=[['baseline',''],['64','64'],['all','all'],['all','all'],['64','64'],['baseline','']];
const destinations=['2026-10-20','2026-10-30','__phi_reception__'];
const quantile=(a,q)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*q)];
async function save(){await writeFile(out+'/results.json',JSON.stringify({environment:'Ubuntu Chromium SwiftShader, fresh browser per variant, reversed second round',results},null,2));}
for(let run=0;run<cases.length;run++){
 const [variant,flag]=cases[run];const result={run:run+1,variant,rides:[],errors:[]};results.push(result);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 page.on('pageerror',error=>result.errors.push(String(error)));
 await page.addInitScript(()=>{
  window.__benchFrames={active:false,last:0,frames:[]};
  const tick=t=>{const b=window.__benchFrames;if(b.active&&b.last)b.frames.push(t-b.last);b.last=t;requestAnimationFrame(tick)};requestAnimationFrame(tick);
 });
 try{
  await page.goto('http://127.0.0.1:4173/gallery/visit/lift-test.html?debug=1&liftprofile=1'+(flag?'&liftcompiletest='+flag:''),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled,null,{timeout:180000});
  result.renderer=await page.evaluate(()=>{const gl=document.querySelector('#world').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),parallelCompile:!!gl.getExtension('KHR_parallel_shader_compile')};});
  await page.locator('#enter').click();
  await page.waitForFunction(()=>document.querySelector('#welcome').hidden);
  for(const date of destinations){
   await page.locator('#openLift').evaluate(e=>e.click());
   await page.waitForFunction(()=>!document.querySelector('#lift').hidden);
   let button;
   if(date==='__phi_reception__')button=page.locator('#liftReception');
   else{
    await page.locator('#liftMonth').evaluate((e,m)=>{e.value=m;e.dispatchEvent(new Event('change',{bubbles:true}));},date.slice(0,7));
    button=page.locator('#liftDays button[title^="'+date+'"]');
   }
   const prior=await page.evaluate(()=>{const b=window.__benchFrames;b.active=true;b.frames=[];b.last=0;return window.__phiLiftProfile.visits.length});
   await button.evaluate(e=>e.click());
   await page.waitForFunction(n=>window.__phiLiftError||(window.__phiLiftProfile.visits.length>n&&window.__phiLiftProfile.visits.at(-1).summary),prior,{timeout:180000});
   const data=await page.evaluate(()=>{window.__benchFrames.active=false;return {frames:window.__benchFrames.frames,profile:window.__phiLiftProfile.visits.at(-1),error:window.__phiLiftError,prep:window.__phiLiftPreparation,loaded:window.__phiFullEngine?.paintingsLoaded,total:window.__phiFullEngine?.paintings};});
   if(data.error)throw Error(JSON.stringify(data.error));
   const stages=data.profile.stages,stage=n=>stages.find(s=>s.name===n);
   const reveal=stage('scene-reveal-finished')?.details;
   const record={date,ms:data.profile.summary.ms,maxFrameMs:Math.max(0,...data.frames),p95FrameMs:quantile(data.frames,.95),stalls100:data.frames.filter(x=>x>=100).length,
    revealMs:stage('scene-reveal-finished').elapsedMs-stage('scene-reveal-start').elapsedMs,
    reveal:{total:reveal?.total,shown:reveal?.shown,batches:reveal?.batches?.length},
    warmup:stage('warmup-details')?.details,loaded:data.loaded,total:data.total,preparationTimedOut:data.prep?.timedOut,
    largestStalls:data.profile.summary.frameSpikeStages.sort((a,b)=>b.ms-a.ms).slice(0,8)};
   result.rides.push(record);
   await writeFile(`${out}/${run+1}-${variant}-${date}-profile.json`,JSON.stringify(data.profile,null,2));
   console.log('LIFT_RESULT '+JSON.stringify({run:run+1,variant,...record}));await save();
   if(data.loaded!==data.total||!data.prep?.paintings?.complete||reveal?.hidden!==0)throw Error('Incomplete destination at door opening');
   await page.waitForFunction(()=>window.__phiLiftRide?.status==='ready',null,{timeout:30000});
   await page.screenshot({path:`${out}/${run+1}-${variant}-${date}.png`});
  }
 }catch(error){result.errors.push(String(error));console.error('LIFT_FAILURE '+JSON.stringify(result));await page.screenshot({path:`${out}/${run+1}-${variant}-failure.png`}).catch(()=>{});}
 finally{await browser.close();await save();}
}
const rows=results.flatMap(r=>r.rides.map(j=>`| ${r.run} | ${r.variant} | ${j.date} | ${(j.ms/1000).toFixed(2)} | ${j.maxFrameMs.toFixed(0)} | ${(j.revealMs/1000).toFixed(2)} | ${j.loaded}/${j.total} |`));
const summary=['# Isolated lift precompile comparison','','Software WebGL only; no production deployment. Two rounds, reversed order, fresh browser per variant.','','| Run | Variant | Destination | Journey s | Worst frame ms | Reveal s | Paintings |','|---|---|---|---:|---:|---:|---|',...rows,'','Failures:',...results.filter(r=>r.errors.length).map(r=>`- Run ${r.run} ${r.variant}: ${r.errors.join('; ')}`)].join('\n');
await writeFile(out+'/SUMMARY.md',summary);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
if(results.some(r=>r.errors.length||r.rides.length!==destinations.length))process.exitCode=1;
