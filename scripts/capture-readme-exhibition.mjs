// Documentary screenshots from the CURRENT live gallery code, run in CI.
// Not renders, mockups or borrowed images: capture actual browser WebGL frames.
import {chromium} from 'playwright';
import {mkdir,stat,writeFile} from 'node:fs/promises';

const OUT='docs/images';
const BASE='http://127.0.0.1:4173/gallery/visit/?debug=1';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const record=[];
let page;
try {
 page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(
  ()=>!document.querySelector('#enter')?.disabled || !!window.__galleryStartupError,
  null,{timeout:210000});
 const loadError=await page.evaluate(()=>window.__galleryStartupError||'');
 if(loadError)throw Error('Live gallery startup: '+loadError);
 await page.locator('#enter').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden&&window.__phiFullEngine?.roomCount>0,
  null,{timeout:60000});
 await page.waitForTimeout(2500);
 // Hide only interface chrome, so screenshots show the gallery artwork and architecture.
 await page.addStyleTag({content:'body > *:not(#world){visibility:hidden!important} #world{visibility:visible!important}'});
 const shot=async (label,date,viewFn)=>{
  await page.evaluate(viewFn);
  await page.waitForTimeout(350);
  const file=OUT+'/exhibition-'+label+'-2026-11-01.jpg';
  const bytes=await page.screenshot({path:file,type:'jpeg',quality:86,timeout:90000});
  if(bytes.length<25000)throw Error('Suspiciously small gallery image: '+label+' '+bytes.length);
  record.push({label,file,bytes:bytes.length,date,source:'real WebGL frame / gallery-phi-bundle.js'});
  console.log('CAPTURE '+JSON.stringify(record.at(-1)));
 };
 await shot('tower','live architectural exterior',()=>window.__phiReceptionPreview.overview());
 await shot('reception','live reception, hologram and furnishing',()=>window.__phiReceptionPreview.show('desk'));
 await page.evaluate(()=>window.__phiReceptionPreview.resume());
 // Follow the same lift/date controls used by the repo's own full-engine tests.
 const target='2026-10-28';
 await page.locator('#openLift').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#lift')?.hidden===false,null,{timeout:30000});
 await page.locator('#liftMonth').evaluate((el,m)=>{
  el.value=m;el.dispatchEvent(new Event('change',{bubbles:true}));
 },target.slice(0,7));
 const destination=page.locator('#liftDays button[title^="'+target+'"]');
 await destination.evaluate(el=>el.click());
 await page.waitForFunction(date=>
  (window.__phiLiftRide?.status==='ready'&&window.__phiFullEngine?.date===date)
  ||!!window.__phiLiftError,target,{timeout:230000});
 const state=await page.evaluate(()=>({
  lift:window.__phiLiftState,error:window.__phiLiftError,
  floor:window.__phiFullEngine
 }));
 if(state.error)throw Error('Lift: '+JSON.stringify(state.error));
 await page.waitForFunction(()=>window.__phiFullEngine?.paintingsLoaded===window.__phiFullEngine?.paintings,
   null,{timeout:90000});
 // Turn from the landing toward the exit, then walk into the real exhibition.
 const golden=(1+Math.sqrt(5))/2;
 const heading=state.lift.floor*(2*Math.PI/(golden*golden))-Math.PI/2;
 const turn=Math.atan2(Math.sin(heading-state.lift.yaw),Math.cos(heading-state.lift.yaw));
 if(Math.abs(turn)>.11){
  const key=turn>0?'ArrowLeft':'ArrowRight';
  await page.keyboard.down(key);
  try {
   await page.waitForFunction(heading=>
    Math.abs(Math.atan2(Math.sin(window.__phiLiftState.yaw-heading),
                      Math.cos(window.__phiLiftState.yaw-heading)))<.1,
    heading,{timeout:45000});
  }finally{await page.keyboard.up(key);}
 }
 await page.keyboard.down('w');
 try{await page.waitForFunction(()=>
  Math.hypot(window.__phiLiftState.x,window.__phiLiftState.z)>3.25,
  null,{timeout:60000});}finally{await page.keyboard.up('w');}
 await page.waitForTimeout(1200);
 await shot('gallery','actual paintings on the 28 October 2026 floor',()=>window.__phiReceptionPreview.resume());
 await writeFile(OUT+'/exhibition-capture-manifest.json',JSON.stringify({
  generatedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,
  note:'Screenshots of actual Three.js render, captured by Chromium using software WebGL. No image synthesis.',
  captures:record,nonfatalPageErrors:errors.slice(0,8)},null,2)+'\n');
 if(record.length!==3)throw Error('Expected three exhibition captures');
}finally{
 await page?.close().catch(()=>{});
 await browser.close();
}
