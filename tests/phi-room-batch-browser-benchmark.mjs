// Source A/B from unchanged test code. Software WebGL is a relative renderer
// check, NOT a prediction of native-GPU frame rate.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const url='http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
const date='2026-10-20',results=[];
const quantile=(values,q)=>{if(!values.length)return null;const a=[...values].sort((x,y)=>x-y);return a[Math.floor((a.length-1)*q)]};
const mean=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
const n=x=>Number.isFinite(x)?+x.toFixed(2):null;
const baseArgs={date,roomcull:1,roomcullbench:1,framebatch:1,captionbatch:1};
const orders=[false,true,true,false];
try{
 for(const [iteration,grouped] of orders.entries()){
  const context=await browser.newContext({viewport:{width:1180,height:720},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  let report={iteration:iteration+1,grouped,status:'failed'};
  try{
   const params=new URLSearchParams({...baseArgs,roombatch:grouped?1:0});
   await page.goto(url+'?'+params,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!!window.__galleryStartupError||
    (window.__phiRoomCullBench?.spots()?.length>0&&!document.querySelector('#enter')?.disabled),
    null,{timeout:180000});
   const startupError=await page.evaluate(()=>window.__galleryStartupError||null);
   if(startupError)throw Error('Gallery failed: '+startupError);
   await page.locator('#enter').evaluate(e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden,
    null,{timeout:20000});
   await page.waitForFunction(()=>window.__phiRoomCullBench?.expectedPaintings()>0&&
    window.__phiRoomCullBench?.paintings()===window.__phiRoomCullBench?.expectedPaintings(),
    null,{timeout:120000});
   await page.waitForTimeout(1500);
   const survey=await page.evaluate(()=>{
    const b=window.__phiRoomCullBench;
    return b.spots().map(p=>{b.move(p.room);const v=b.setCulling(true);return {
      room:p.room,hidden:v?.hidden||0,groups:v?.culledRooms||[]
    }});
   });
   const withCull=survey.filter(x=>x.hidden>0).sort((a,b)=>b.hidden-a.hidden);
   const noCull=survey.find(x=>x.hidden===0);
   const chosen=[withCull[0],noCull].filter((x,i,a)=>x&&!a.slice(0,i).some(y=>y.room===x.room));
   if(!withCull.length||chosen.length<2)throw Error('Expected both hidden and visible control room');
   const samples=[];
   for(const spot of chosen){
    await page.evaluate(room=>{
     const b=window.__phiRoomCullBench;
     b.move(room);b.setCulling(true);
    },spot.room);
    await page.waitForTimeout(400);
    await page.evaluate(()=>window.__phiRoomCullBench.reset());
    await page.waitForTimeout(2400);
    const state=await page.evaluate(()=>{
     const b=window.__phiRoomCullBench;
     return {frames:b.sample(),visibility:b.culling(),roomBatches:window.__phiRoomBatches?.(),
      caption:window.__phiCaptionBatches,framesBatch:window.__phiFrameBatches};
    });
    const frames=state.frames;
    const data={room:spot.room,hidden:spot.hidden,
     sampleCount:frames.length,
     p50RenderMs:n(quantile(frames.map(f=>f.ms),.5)),
     p95RenderMs:n(quantile(frames.map(f=>f.ms),.95)),
     meanSceneCalls:n(mean(frames.map(f=>f.sceneCalls))),
     meanTriangles:n(mean(frames.map(f=>f.sceneTriangles))),
     meanScenePasses:n(mean(frames.map(f=>f.sceneRenderPasses))),
     actualHidden:state.visibility?.hidden??null,
     roomBatchStats:state.roomBatches,
     captionStats:state.caption,frameStats:state.framesBatch};
    samples.push(data);
    console.log('ROOM_BATCH_SPOT '+JSON.stringify({iteration:iteration+1,grouped,...data}));
   }
   report={iteration:iteration+1,grouped,status:'complete',date,survey,samples,errors};
  }catch(error){
   report={iteration:iteration+1,grouped,status:'failed',error:String(error),errors};
   console.error('ROOM_BATCH_FAILURE '+JSON.stringify(report));
  }
  results.push(report);await context.close();
 }
 await mkdir('phi-room-batch-benchmark',{recursive:true});
 await writeFile('phi-room-batch-benchmark/results.json',JSON.stringify({
   environment:'GitHub Actions Ubuntu Chromium SwiftShader software WebGL',
   method:'Alternating ABBA order, identical artwork and positions, warm frames, culling enabled in both configurations',
   date,results
  },null,2));
 const rows=results.filter(x=>x.status==='complete').flatMap(x=>x.samples.map(s=>({grouped:x.grouped,...s})));
 const hidden=rows.filter(x=>x.hidden>0&&x.sampleCount>0),control=rows.filter(x=>x.hidden===0&&x.sampleCount>0);
 const summary={runs:results.length,complete:results.filter(x=>x.status==='complete').length,
   hiddenRooms:results[0]?.survey?.filter(x=>x.hidden>0).length??null,
   groupedHiddenCalls:n(mean(hidden.filter(x=>x.grouped).map(x=>x.meanSceneCalls))),
   globalHiddenCalls:n(mean(hidden.filter(x=>!x.grouped).map(x=>x.meanSceneCalls))),
   groupedControlCalls:n(mean(control.filter(x=>x.grouped).map(x=>x.meanSceneCalls))),
   globalControlCalls:n(mean(control.filter(x=>!x.grouped).map(x=>x.meanSceneCalls))),
   groupedHiddenP50Ms:n(mean(hidden.filter(x=>x.grouped).map(x=>x.p50RenderMs))),
   globalHiddenP50Ms:n(mean(hidden.filter(x=>!x.grouped).map(x=>x.p50RenderMs))),
   framesMeasured:rows.reduce((n,x)=>n+x.sampleCount,0)};
 console.log('ROOM_BATCH_SUMMARY '+JSON.stringify(summary));
 if(results.some(r=>r.status!=='complete'))process.exitCode=1;
}finally{await browser.close();}
