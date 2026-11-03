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
 await page.addStyleTag({content:'body > *:not(#world){visibility:hidden!important} #world{visibility:visible!important}'});
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
 // Third documentary view: the reception's interactive gramophone exhibit.
 // An upper-floor visit is deliberately not forced in the software-GPU
 // screenshot job: it can time out on painting upload even while the live
 // physical-GPU exhibition remains usable.
 await shot('gramophone','live reception gramophone installation',()=>window.__phiReceptionPreview.show('gramophone'));
 await page.evaluate(()=>window.__phiReceptionPreview.resume());
 await writeFile(OUT+'/exhibition-capture-manifest.json',JSON.stringify({
  generatedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,
  note:'Screenshots of actual Three.js render, captured by Chromium using software WebGL. No image synthesis.',
  captures:record,nonfatalPageErrors:errors.slice(0,8)},null,2)+'\n');
 if(record.length!==3)throw Error('Expected three exhibition captures');
}finally{
 await page?.close().catch(()=>{});
 await browser.close();
}
