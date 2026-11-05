import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const root='duck-proof';
await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:900,height:1420},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/gallery/visit/?debug=1',
   {waitUntil:'domcontentloaded',timeout:85000});
 await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled||!!window.__galleryStartupError,null,{timeout:240000});
 const error=await page.evaluate(()=>window.__galleryStartupError||null);
 if(error)throw Error('Gallery startup '+error);
 await page.locator('#enter').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden&&!!window.__phiReceptionPreview?.duckExterior,null,{timeout:110000});
 await page.waitForTimeout(1400);
 await page.addStyleTag({content:'body > *:not(#world){visibility:hidden!important} #world{visibility:visible!important}'});
 const views=[
  {file:'tower_outside_low_01.jpg',x:35,z:-65,targetY:66,fov:78},
  {file:'tower_outside_low_02.jpg',x:18,z:-88,targetY:79,fov:80},
  {file:'tower_outside_low_03.jpg',x:-36,z:-85,targetY:84,fov:78},
  {file:'tower_outside_low_04.jpg',x:53,z:-98,targetY:90,fov:72},
  {file:'tower_outside_low_05.jpg',x:75,z:-135,targetY:87,fov:60},
  {file:'tower_outside_low_06.jpg',x:15,z:-125,targetY:85,fov:64},
 ];
 const results=[];
 for(const view of views){
  const pose=await page.evaluate(v=>window.__phiReceptionPreview.duckExterior(v.x,v.z,v.targetY,v.fov),view);
  await page.waitForTimeout(650);
  const bytes=await page.screenshot({path:root+'/'+view.file,type:'jpeg',quality:92});
  if(bytes.length<20000)throw Error('Blank camera '+view.file+' bytes='+bytes.length);
  results.push({...view,bytes:bytes.length,pose});console.log('TOWER '+view.file+' '+bytes.length);
 }
 await fs.writeFile(root+'/tower-viewpoints.json',JSON.stringify({results,errors},null,2));
}finally{await page.close().catch(()=>{});await browser.close();}
