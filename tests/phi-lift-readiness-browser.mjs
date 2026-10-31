// Full rendered test-tower journey. A PASS means the door-open event follows
// every painting attachment and successful GPU texture initialization.
// The CI GPU is SwiftShader; do not use its frame times as hardware FPS.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.PHI_TEST_SERVER||'http://127.0.0.1:4173';
const date='2026-10-20';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const report={date,environment:'Chromium SwiftShader software WebGL',liftreuse:process.env.PHI_LIFT_REUSE??'default'};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(base+'/'+(process.env.PHI_LIFT_TARGET==='live'?'gallery/visit/':'test/virtual-gallery/full-engine.html')+
  '?debug=1&liftprofile=1'+(process.env.PHI_LIFT_REUSE==null?'':'&liftreuse='+process.env.PHI_LIFT_REUSE),
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled||
   !!window.__galleryStartupError,null,{timeout:180000});
 assert.equal(await page.evaluate(()=>window.__galleryStartupError||''),'','Gallery startup error');
 await page.locator('#enter').evaluate(element=>element.click());
 await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,null,{timeout:30000});
 await page.locator('#openLift').evaluate(element=>element.click());
 await page.waitForFunction(()=>document.querySelector('#lift')?.hidden===false,null,{timeout:20000});
 await page.locator('#liftMonth').evaluate((element,month)=>{
  element.value=month;element.dispatchEvent(new Event('change',{bubbles:true}));
 },date.slice(0,7));
 const button=page.locator('#liftDays button[title^="'+date+'"]');
 assert.ok(await button.count(),'Requested archive date must exist');
 await button.evaluate(element=>element.click());
 await page.waitForFunction(()=>window.__phiLiftRide?.status==='opening'||
   !!window.__phiLiftError,null,{timeout:215000});
 const result=await page.evaluate(()=>{
  const gate=window.__phiLiftPreparation?.paintings||window.__phiLiftPaintings||null;
  const visit=window.__phiLiftProfile?.visits?.at(-1)||null;
  const stages=visit?.stages||[];
  const at=name=>stages.findIndex(stage=>stage.name===name);
  const elapsed=name=>stages.find(stage=>stage.name===name)?.elapsedMs??null;
  return {
   status:window.__phiLiftRide?.status,
   error:window.__phiLiftError||null,
   expected:window.__phiFullEngine?.paintings??null,
   paintingsLoaded:window.__phiFullEngine?.paintingsLoaded??null,
   gate,
   paintPreload:window.__phiArtworkPreload?.()||null,
   paintingGpu:window.__phiLiftPaintingGPU?.()||null,
   warmup:stages.find(s=>s.name==='warmup-details')?.details||null,
   paintingWaitMs:elapsed('paintings-gpu-ready')==null||elapsed('paintings-waiting')==null?null:
    +(elapsed('paintings-gpu-ready')-elapsed('paintings-waiting')).toFixed(1),
   finalWarmupMs:elapsed('texture-upload-and-compile-finished')==null||elapsed('deferred-pump-finished')==null?null:
    +(elapsed('texture-upload-and-compile-finished')-elapsed('deferred-pump-finished')).toFixed(1),
   arrivalDelayMs:elapsed('doors-opening')==null||elapsed('ride-finished')==null?null:
    +(elapsed('doors-opening')-elapsed('ride-finished')).toFixed(1),
   paintingReadyBeforeDoor:at('paintings-gpu-ready')>=0&&
    at('doors-opening')>at('paintings-gpu-ready'),
   stages:stages.map(s=>({name:s.name,elapsedMs:s.elapsedMs})),
   frameStalls:visit?.frames?.slice(0,120)||[],
   cpuOperations:visit?.operations||null,
   cpuOperationSpikes:visit?.operationSpikes||[]
  };
 });
 Object.assign(report,result,{uncaughtPageErrors:errors});
 await mkdir('phi-lift-readiness-results',{recursive:true});
 await writeFile('phi-lift-readiness-results/arrival'+(process.env.PHI_LIFT_REUSE==null?'':'-'+process.env.PHI_LIFT_REUSE)+'.json',JSON.stringify(report,null,2));
 console.log('LIFT_PAINTING_ARRIVAL_REPORT '+JSON.stringify(report));
 assert.equal(result.error,null,'Lift reported preparation failure');
 assert.equal(result.status,'opening','Doors must open only after preparation');
 assert.ok(result.expected>0,'Destination needs paintings');
 assert.equal(result.paintingsLoaded,result.expected,'All painting textures attached before opening');
 assert.equal(result.gate?.registered,result.expected,'Every painting registered');
 assert.equal(result.gate?.ready,result.expected,'Every painting GPU-uploaded');
 assert.equal(result.gate?.complete,true,'Painting gate fully ready');
 assert.equal(result.gate?.failures.length,0,'No painting loads failed');
 assert.equal(result.paintingReadyBeforeDoor,true,'Opening strictly after GPU-ready stage');
 assert.deepEqual(errors,[],'No uncaught JavaScript errors');
 console.log('LIFT_PAINTING_ARRIVAL_PASS');
}finally{await browser.close()}
