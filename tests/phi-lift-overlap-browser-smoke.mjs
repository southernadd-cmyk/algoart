// Functional A/B for opt-in lift overlap. Software WebGL is NOT a GPU speed benchmark.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const BASE=process.env.PHI_TEST_SERVER||'http://127.0.0.1:4173';
const TARGET='2026-10-20';
const output='phi-lift-overlap-results';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const report={date:TARGET,renderer:'Chromium SwiftShader (functional smoke, not hardware FPS)',runs:[]};
try{
 for(const overlap of ['0','1']){
  const context=await browser.newContext({viewport:{width:1160,height:750},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  // Record the display actually carried by the visible moving cabin, not
  // only the new destination indicator allocated during construction.
  await page.addInitScript(()=>{
   window.__phiIndicatorSamples=[];
   function observe(){
    const ride=window.__phiLiftRide,state=window.__phiLiftState;
    if(ride?.status==='moving'&&state?.indicator){
     const samples=window.__phiIndicatorSamples;
     if(samples.length<4000)samples.push({
      y:state.y,progress:ride.progress,primary:state.indicator.primary,
      secondary:state.indicator.secondary
     });
    }
    requestAnimationFrame(observe);
   }
   requestAnimationFrame(observe);
  });
  const row={overlap,status:'failed',start:Date.now()};
  try{
   await page.goto(BASE+'/test/virtual-gallery/full-engine.html?debug=1&liftprofile=1&liftoverlap='+overlap,
    {waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled||!!window.__galleryStartupError,null,{timeout:180000});
   const startupError=await page.evaluate(()=>window.__galleryStartupError||null);
   if(startupError)throw Error('Startup failed: '+startupError);
   await page.locator('#enter').evaluate(el=>el.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,null,{timeout:20000});
   await page.locator('#openLift').evaluate(el=>el.click());
   await page.waitForFunction(()=>document.querySelector('#lift')?.hidden===false,null,{timeout:16000});
   await page.locator('#liftMonth').evaluate((el,month)=>{
    el.value=month;el.dispatchEvent(new Event('change',{bubbles:true}));
   },TARGET.slice(0,7));
   const choice=page.locator('#liftDays button[title^="'+TARGET+'"]');
   if(!(await choice.count()))throw Error('Target date not offered in lift');
   const title=await choice.getAttribute('title');
   const targetFloor=Number(title?.match(/floor (\d+)/)?.[1]);
   if(!Number.isFinite(targetFloor))throw Error('Invalid target floor '+title);
   await choice.evaluate(el=>el.click());
   const rideBegan=Date.now();
   await page.waitForFunction(()=>window.__phiLiftRide?.status==='opening'||!!window.__phiLiftError,
    null,{timeout:200000});
   const details=await page.evaluate(()=>{
    const visit=window.__phiLiftProfile?.visits?.at(-1);
    const stages=visit?.stages||[];
    const stage=name=>stages.find(x=>x.name===name)?.elapsedMs??null;
    return {ride:window.__phiLiftRide,lighting:window.__phiLightingStats||null,
     gallery:window.__phiFullEngine,gate:window.__phiLiftPreparation?.paintings,
     cabin:window.__phiLiftState,stages:stages.map(({name,elapsedMs})=>({name,elapsedMs})),
     overlayStart:stage('ride-construction-start'),destinationReady:stage('destination-ready-in-ride'),
     paintingReady:stage('paintings-gpu-ready'),doorsOpening:stage('doors-opening'),
     error:window.__phiLiftError||null,
     graffiti:window.__phiGraffitiStats||null,
     // A floor indicator must not remain at G once the cabin is clearly
     // above ground. This caught the original overlapping-cabin regression.
     indicatorSamples:window.__phiIndicatorSamples||[]
    };
   });
   row.tripMs=Date.now()-rideBegan;
   row.details=details;row.errors=errors;
   await page.screenshot({path:output+'/arrival-overlap-'+overlap+'.png'});
   if(details.error)throw Error('Lift error: '+JSON.stringify(details.error).slice(0,500));
   if(details.ride?.status!=='opening')throw Error('Doors never opened');
   if(details.gallery?.paintingsLoaded!==details.gallery?.paintings || !details.gallery?.paintings)
    throw Error('Some painting textures are not loaded');
   if(details.gate?.complete!==true)throw Error('Painting GPU gate not complete');
   if(details.cabin?.floor!==targetFloor)throw Error('Wrong arrival floor');
   if(details.cabin?.doorCount<2)throw Error('Destination cabin door leaves missing');
   const actualRide=details.indicatorSamples.filter(x=>Number.isFinite(x.y)&&x.progress>=.15);
   const upper=actualRide.filter(x=>x.y>12.4);
   if(!upper.length)throw Error('No moving-cabin indicator samples from above the ground floor');
   const wrong=upper.filter(x=>x.primary?.startsWith('G · Reception'));
   if(wrong.length)throw Error('Moving cabin indicator reverted to G · Reception above ground: '+JSON.stringify(wrong.slice(0,3)));
   if(details.paintingReady===null||details.doorsOpening===null||
      details.paintingReady>=details.doorsOpening)throw Error('Doors opened before paintings');
   if(overlap==='1'){
    if(details.overlayStart===null||details.destinationReady===null)
     throw Error('Missing overlap profiler stages');
    if(details.overlayStart>=details.destinationReady)throw Error('Overlapped stage order incorrect');
   }else if(details.overlayStart!==null)throw Error('Control unexpectedly constructed during ride');
   if(errors.length)throw Error('JavaScript page errors: '+errors.join('; ').slice(0,500));
   row.status='passed';row.message='Painting ready; correct floor/cabin; doors opened';
  }catch(error){row.error=String(error);console.error('PHI_LIFT_OVERLAP_FAILURE '+JSON.stringify({overlap,error:row.error}));}
  report.runs.push(row);
  console.log('PHI_LIFT_OVERLAP_RUN '+JSON.stringify({overlap,status:row.status,tripMs:row.tripMs,
   stages:row.details?.stages?.filter(x=>/ride|construction|paintings-gpu-ready|doors-opening|destination-ready/.test(x.name)),
   error:row.error}));
  await writeFile(output+'/results.json',JSON.stringify(report,null,2)+'\n');
  await context.close();
 }
}finally{await browser.close()}
if(report.runs.some(x=>x.status!=='passed'))process.exitCode=1;
