import {chromium} from 'playwright';
const base='https://southernadd-cmyk.github.io/algoart/gallery/visit/';
const atlas=new URL('touchdesigner/six-screen-installation.webm',base).href;
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-dev-shm-usage']});
const test=async(page,label)=>{
 const result=await page.evaluate(async url=>{
  const v=document.createElement('video');
  v.src=url;v.preload='auto';v.playsInline=true;v.muted=true;v.loop=true;
  let frames=0,firstFrameAt=null,lastFrameAt=null;
  const errors=[];
  v.addEventListener('error',()=>errors.push('error '+v.error?.code));
  v.addEventListener('waiting',()=>errors.push('waiting '+v.currentTime));
  const collect=(at,info)=>{
   frames++;if(firstFrameAt==null)firstFrameAt=at;lastFrameAt=at;
   v.requestVideoFrameCallback?.(collect);
  };
  try{
   await new Promise((res,rej)=>{
    const t=setTimeout(()=>rej(Error('load timeout')),30000);
    v.addEventListener('loadeddata',()=>{clearTimeout(t);res();},{once:true});
    v.addEventListener('error',()=>{clearTimeout(t);rej(Error('decode failure'));},{once:true});
   });
   v.requestVideoFrameCallback?.(collect);
   await v.play();
   const before={date:Date.now(),time:v.currentTime,paused:v.paused};
   await new Promise(r=>setTimeout(r,5000));
   const after={date:Date.now(),time:v.currentTime,paused:v.paused};
   return {before,after,elapsedMs:after.date-before.date,mediaAdvance:after.time-before.time,
    frames,frameRatePerRealSecond:frames/((after.date-before.date)/1000),
    ready:v.readyState,network:v.networkState,errors,
    frameSpan:firstFrameAt==null?null:lastFrameAt-firstFrameAt};
  }catch(e){return {error:String(e),ready:v.readyState,errors,frames};}
  finally{v.pause();v.removeAttribute('src');v.load();}
 },atlas);
 console.log('VIDEO_AB '+JSON.stringify({label,...result}));
};
try{
 let page=await browser.newPage();
 await page.goto(new URL('touchdesigner/six-screen.json',base).href,{waitUntil:'domcontentloaded',timeout:45000});
 await test(page,'isolated-video-with-no-gallery');
 await page.close();
 page=await browser.newPage({viewport:{width:1000,height:700}});
 page.on('pageerror',e=>console.log('VIDEO_PAGE_ERROR '+e.message));
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>document.getElementById('enter')?.disabled===false,null,{timeout:115000});
 await page.locator('#enter').click({noWaitAfter:true});
 await page.waitForFunction(()=>document.getElementById('welcome')?.hidden===true,null,{timeout:45000});
 console.log('GALLERY_READY '+JSON.stringify(await page.evaluate(()=>({floor:window.__phiFullEngine?.date,monitor:window.__phiLivingMonitorDiagnostics?.placed,webgl:!!document.querySelector('#world')}))));
 await test(page,'video-while-full-reception-renders');
 await page.close();
}finally{await browser.close();}
