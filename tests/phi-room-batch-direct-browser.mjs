// Direct single-scene A/B draw calls, avoiding software post-FX frame stalls.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl',
 '--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const rows=[],date='2026-10-20',base='http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
try{
 for(const grouped of [false,true]){
  const context=await browser.newContext({viewport:{width:1180,height:720},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(base+'?'+new URLSearchParams({date,captionbatch:1,framebatch:1,
    roomcull:1,roombatch:Number(grouped),roomcullbench:1}),{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__galleryStartupError||(
    window.__phiRoomCullBench?.spots()?.length>0 && !document.querySelector('#enter')?.disabled),
    null,{timeout:180000});
   if(await page.evaluate(()=>!!window.__galleryStartupError))throw Error('Gallery startup failed');
   await page.locator('#enter').evaluate(e=>e.click());
   await page.waitForFunction(()=>window.__phiRoomCullBench?.expectedPaintings()>0 &&
    window.__phiRoomCullBench?.paintings()===window.__phiRoomCullBench?.expectedPaintings(),
    null,{timeout:120000});
   await page.waitForTimeout(900);
   const spots=await page.evaluate(()=>{
    const b=window.__phiRoomCullBench;
    return b.spots().map(x=>{b.move(x.room);return {room:x.room,hidden:b.setCulling(true).hidden}});
   });
   const best=[...spots].sort((a,b)=>b.hidden-a.hidden)[0],control=spots.find(x=>x.hidden===0);
   if(!best||best.hidden===0||!control)throw Error('No blocked and control room');
   for(const spot of [best,control]){
    for(const yaw of [0,.5,1.57,3.14,4.71]){
     const result=await page.evaluate(({room,yaw})=>{
      const b=window.__phiRoomCullBench;
      b.move(room);b.look(yaw);
      b.setCulling(false);
      const off=b.directSceneRender();
      b.setCulling(true);
      const on=b.directSceneRender();
      return {room,yaw,off,on,visibility:b.culling(),
       groupedInfo:window.__phiRoomBatches?.(),frames:window.__phiFrameBatches,
       captions:window.__phiCaptionBatches};
     },{room:spot.room,yaw});
     const line={grouped,room:spot.room,potentialHidden:spot.hidden,yaw,
      callsOff:result.off.calls,callsOn:result.on.calls,
      callsSaved:result.off.calls-result.on.calls,
      trianglesOff:result.off.triangles,trianglesOn:result.on.triangles,
      renderOffMs:Math.round(result.off.ms),renderOnMs:Math.round(result.on.ms),
      groupsHidden:result.visibility.hidden};
     rows.push(line);console.log('ROOM_DIRECT '+JSON.stringify(line));
    }
   }
   console.log('ROOM_DIRECT_DETAILS '+JSON.stringify({grouped,stats:await page.evaluate(()=>window.__phiRoomBatches?.()),errors}));
  }catch(error){
   const line={grouped,error:String(error),errors};rows.push(line);
   console.error('ROOM_DIRECT_FAILURE '+JSON.stringify(line));
  }
  await context.close();
 }
 await mkdir('phi-room-batch-direct',{recursive:true});
 await writeFile('phi-room-batch-direct/results.json',JSON.stringify({
   date,environment:'Chromium SwiftShader software renderer',method:'Direct Three.js scene render, identical camera room centres and yaw angles, with per-mode culling OFF then ON',rows
 },null,2));
 const comparison=rows.filter(r=>!r.error&&r.potentialHidden>0);
 const summary={
  baselineWithCulling:comparison.filter(r=>!r.grouped).map(r=>({room:r.room,yaw:r.yaw,calls:r.callsOn})),
  groupedWithCulling:comparison.filter(r=>r.grouped).map(r=>({room:r.room,yaw:r.yaw,calls:r.callsOn})),
  groupedPositiveSavings:comparison.filter(r=>r.grouped&&r.callsSaved>0).length,
  totalGroupSamples:comparison.filter(r=>r.grouped).length
 };
 console.log('ROOM_DIRECT_SUMMARY '+JSON.stringify(summary));
 if(rows.some(r=>r.error))process.exitCode=1;
}finally{await browser.close();}
