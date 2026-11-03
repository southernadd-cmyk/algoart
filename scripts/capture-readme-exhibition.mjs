// Documentary screenshots from the CURRENT live gallery code, run in CI.
// Not renders, mockups or borrowed images: capture actual browser WebGL frames.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const OUT='docs/images';
// Each automated run writes genuinely new documentary captures under its capture date.
const CAPTURE_DATE=new Date().toISOString().slice(0,10);
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
 const hideChrome=await page.addStyleTag({content:'body > *:not(#world){visibility:hidden!important} #world{visibility:visible!important}'});
 const shot=async (label,date,viewFn)=>{
  await page.evaluate(viewFn);
  await page.waitForTimeout(350);
  const file=OUT+'/exhibition-'+label+'-'+CAPTURE_DATE+'.jpg';
  const bytes=await page.screenshot({path:file,type:'jpeg',quality:86,timeout:90000});
  if(bytes.length<25000)throw Error('Suspiciously small gallery image: '+label+' '+bytes.length);
  record.push({label,file,bytes:bytes.length,date,source:'real WebGL frame / gallery-phi-bundle.js'});
  console.log('CAPTURE '+JSON.stringify(record.at(-1)));
 };
 await shot('tower','live architectural exterior',()=>window.__phiReceptionPreview.overview());
 await shot('reception','live reception, hologram and furnishing',()=>window.__phiReceptionPreview.show('desk'));
 await page.evaluate(()=>window.__phiReceptionPreview.resume());
 // Reception's real TouchDesigner backroom: two banks of installed screens.
 await page.waitForFunction(()=>window.__phiLivingMonitorDiagnostics?.placed===true,
   null,{timeout:20000});
 const tdView=await page.evaluate(()=>window.__phiEditorialCapture.td());
 if(!tdView?.ok||tdView.banks!==2)throw Error('TouchDesigner shot not ready: '+JSON.stringify(tdView));
 await page.waitForTimeout(450);
 const tdFile=OUT+'/exhibition-touchdesigner-'+CAPTURE_DATE+'.jpg';
 const tdBytes=await page.screenshot({path:tdFile,type:'jpeg',quality:90,timeout:90000});
 if(tdBytes.length<30000)throw Error('Suspiciously small TD screenshot '+tdBytes.length);
 record.push({label:'touchdesigner',file:tdFile,bytes:tdBytes.length,
   date:'reception TouchDesigner exhibition area',
   source:'real WebGL frame / gallery-phi-bundle.js',camera:tdView});
 console.log('CAPTURE '+JSON.stringify(record.at(-1)));
 await page.evaluate(()=>window.__phiEditorialCapture.resume());
 // The documentary camera loads the genuine published Three.js floor, but
 // avoids a long physical lift animation in software WebGL CI.
 await hideChrome.evaluate(element=>element.remove());
 const floorLoad=await page.evaluate(async()=>window.__phiEditorialCapture.edition('2026-10-28'));
 if(floorLoad?.date!=='2026-10-28'||floorLoad.paintings<1)
   throw Error('Published floor did not load: '+JSON.stringify(floorLoad));
 await page.waitForFunction(()=>{
   const floor=window.__phiFullEngine;
   return floor?.date==='2026-10-28'&&floor.paintings>0&&
     floor.paintingsLoaded===floor.paintings;
 },null,{timeout:180000});
 await page.waitForTimeout(1200);
 const roomState=await page.evaluate(()=>window.__phiFullEngine);
 if(roomState.date!=='2026-10-28'||roomState.paintingsLoaded!==roomState.paintings)
   throw Error('Gallery floor failed the fully loaded artwork check');
 const paintView=await page.evaluate(()=>window.__phiEditorialCapture.painting());
 if(!paintView?.ok||paintView.metresFromLift<3)
   throw Error('Gallery painting viewpoint invalid: '+JSON.stringify(paintView));
 const hideGalleryChrome=await page.addStyleTag({content:'body > *:not(#world){visibility:hidden!important} #world{visibility:visible!important}'});
 await page.waitForTimeout(500);
 const galleryFile=OUT+'/exhibition-gallery-floor-'+CAPTURE_DATE+'.jpg';
 const galleryBytes=await page.screenshot({path:galleryFile,type:'jpeg',quality:90,timeout:90000});
 if(galleryBytes.length<30000)throw Error('Suspiciously small gallery floor screenshot '+galleryBytes.length);
 record.push({label:'gallery-floor',file:galleryFile,bytes:galleryBytes.length,
   date:'28 October 2026 upper-floor gallery, visitor looking at a painting',
   source:'real WebGL frame / gallery-phi-bundle.js',
   paintings:roomState.paintings,paintingsLoaded:roomState.paintingsLoaded,camera:paintView});
 console.log('CAPTURE '+JSON.stringify(record.at(-1)));
 await hideGalleryChrome.evaluate(element=>element.remove());
 await writeFile(OUT+'/exhibition-capture-manifest.json',JSON.stringify({
  generatedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,
  note:'Screenshots of actual Three.js render, captured by Chromium using software WebGL. No image synthesis.',
  captures:record,nonfatalPageErrors:errors.slice(0,8)},null,2)+'\n');
 if(record.length!==4)throw Error('Expected four exhibition captures');
}finally{
 await page?.close().catch(()=>{});
 await browser.close();
}
