// Full Three.js Chromium A/B: same floor, same room/camera positions, warm assets,
// alternating OFF/ON in one session. SwiftShader is a SOFTWARE WebGL renderer:
// these are relative CI measurements, not native-GPU FPS predictions.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base='http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
const dates=['2026-10-20','2026-10-30'];
const all=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sorted=a=>[...a].sort((x,y)=>x-y);
const p=(xs,q)=>xs.length?sorted(xs)[Math.floor((xs.length-1)*q)]:null;
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const round=x=>Number.isFinite(x)?Math.round(x*100)/100:null;
const describe=(samples)=>({
 count:samples.length,
 renderMs:{mean:round(avg(samples.map(s=>s.ms))),p50:round(p(samples.map(s=>s.ms),.5)),p95:round(p(samples.map(s=>s.ms),.95)),max:round(Math.max(0,...samples.map(s=>s.ms)))},
 drawCalls:round(avg(samples.map(s=>s.sceneCalls))),
 triangles:round(avg(samples.map(s=>s.sceneTriangles))),
 scenePasses:round(avg(samples.map(s=>s.sceneRenderPasses))),
 hidden:round(avg(samples.map(s=>s.hidden)))
});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
try{
 for(const date of dates){
  const context=await browser.newContext({viewport:{width:1180,height:720},deviceScaleFactor:1,
   locale:'en-GB',timezoneId:'Europe/London'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  let report={date,status:'failed'};
  try{
   const target=base+'?date='+date+
    '&roomcull=1&roomcullbench=1&captionbatch=1&framebatch=1';
   await page.goto(target,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__galleryStartupError||
    (window.__phiRoomCullBench?.spots()?.length>0&&!document.querySelector('#enter')?.disabled),
    null,{timeout:180000});
   const startup=await page.evaluate(()=>window.__galleryStartupError||null);
   if(startup)throw Error('Startup failed: '+startup);
   await page.locator('#enter').evaluate(el=>el.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,
    null,{timeout:20000});
   await page.waitForFunction(()=>window.__phiRoomCullBench?.expectedPaintings()>0 &&
    window.__phiRoomCullBench?.paintings()===window.__phiRoomCullBench?.expectedPaintings(),
    null,{timeout:120000});
   // Let other deferred exhibit construction settle before timing either mode.
   await page.waitForTimeout(2200);
   const spots=await page.evaluate(()=>{
    const bench=window.__phiRoomCullBench;
    return bench.spots().map(spot=>{
     bench.move(spot.room);
     const on=bench.setCulling(true);
     return {...spot,potentialHidden:on.hidden,culledRooms:on.culledRooms};
    });
   });
   if(!spots.length)throw Error('No room centres to sample');
   // Predeclare sampling positions: maximum culling, two intermediates,
   // and a no-/minimal-culling control (unique room IDs).
   const ranked=sorted(spots.map(s=>s.potentialHidden));
   const byHidden=[...spots].sort((a,b)=>b.potentialHidden-a.potentialHidden||a.room-b.room);
   const chosen=[];
   for(const index of [0,Math.floor((byHidden.length-1)/3),
    Math.floor((byHidden.length-1)*2/3),byHidden.length-1]){
    const candidate=byHidden[index];
    if(candidate&&!chosen.some(x=>x.room===candidate.room))chosen.push(candidate);
   }
   const captures=[];
   for(const spot of chosen){
    const rows=[];
    // ABBA and per-run medians reduce warm-up and extreme frame-spike bias.
    // Report all four run samples so the remaining variability is visible.
    for(const on of [false,true,true,false]){
     const state=await page.evaluate(({room,on})=>{
      const bench=window.__phiRoomCullBench;
      bench.move(room);
      return bench.setCulling(on);
     },{room:spot.room,on});
     await page.waitForTimeout(500);
     await page.evaluate(()=>window.__phiRoomCullBench.reset());
     await page.waitForTimeout(1800);
     const samples=await page.evaluate(()=>window.__phiRoomCullBench.sample());
     const summary=describe(samples);
     rows.push({mode:on?'on':'off',state,summary});
    }
    const off=rows.filter(r=>r.mode==='off').flatMap(r=>r.summary.count?[r.summary]:[]);
    const on=rows.filter(r=>r.mode==='on').flatMap(r=>r.summary.count?[r.summary]:[]);
    captures.push({room:spot.room,area:spot.area,potentialHidden:spot.potentialHidden,
     framesOff:off.reduce((n,x)=>n+x.count,0),framesOn:on.reduce((n,x)=>n+x.count,0),
     off:{renderMs:round(avg(off.map(x=>x.renderMs.p50))),renderP95Ms:round(avg(off.map(x=>x.renderMs.p95))),drawCalls:round(avg(off.map(x=>x.drawCalls))),
      triangles:round(avg(off.map(x=>x.triangles)))},
     on:{renderMs:round(avg(on.map(x=>x.renderMs.p50))),renderP95Ms:round(avg(on.map(x=>x.renderMs.p95))),drawCalls:round(avg(on.map(x=>x.drawCalls))),
      triangles:round(avg(on.map(x=>x.triangles))),hidden:round(avg(on.map(x=>x.hidden)))},
     runs:rows});
    console.log('ROOM_CULL_SPOT '+JSON.stringify({date,room:spot.room,hidden:spot.potentialHidden,
     off:captures.at(-1).off,on:captures.at(-1).on}));
   }
   const summary={
    rooms:spots.length,roomsWithCulling:spots.filter(s=>s.potentialHidden>0).length,
    maxObjectsHidden:Math.max(...spots.map(s=>s.potentialHidden)),
    averageObjectsHidden:round(avg(spots.map(s=>s.potentialHidden))),
    selectedRooms:chosen.map(s=>s.room),
    avgOffMs:round(avg(captures.map(c=>c.off.renderMs).filter(Number.isFinite))),
    avgOnMs:round(avg(captures.map(c=>c.on.renderMs).filter(Number.isFinite))),
    avgDrawCallsOff:round(avg(captures.map(c=>c.off.drawCalls).filter(Number.isFinite))),
    avgDrawCallsOn:round(avg(captures.map(c=>c.on.drawCalls).filter(Number.isFinite)))
   };
   const saved=summary.avgDrawCallsOff-summary.avgDrawCallsOn;
   summary.drawCallDifference=round(saved);
   summary.renderTimeDifferenceMs=round(summary.avgOffMs-summary.avgOnMs);
   summary.renderTimeDifferencePercent=round(100*(summary.avgOffMs-summary.avgOnMs)/summary.avgOffMs);
   report={date,status:'complete',environment:'GitHub Actions Chromium SwiftShader software WebGL',
    expectedPaintings:await page.evaluate(()=>window.__phiRoomCullBench.expectedPaintings()),
    roomSurvey:spots,summary,captures,jsErrors:errors};
   console.log('ROOM_CULL_DATE_SUMMARY '+JSON.stringify({date,...summary}));
  }catch(error){report={date,status:'failed',error:String(error),jsErrors:errors};
   console.error('ROOM_CULL_FAILURE '+JSON.stringify(report));}
  all.push(report);
  await context.close();
 }
 await mkdir('phi-room-culling-benchmark',{recursive:true});
 const result={environment:'Ubuntu GitHub Actions, Chromium SwiftShader (software renderer)',method:'One warmed browser session per floor; all room centres surveyed; four selected rooms sampled in OFF/ON/ON/OFF sequence at identical camera positions; 500ms settle + 1800ms measured per mode',dates,results:all};
 await writeFile('phi-room-culling-benchmark/results.json',JSON.stringify(result,null,2));
 console.log('ROOM_CULL_BENCHMARK_COMPLETE '+JSON.stringify(result.results.map(r=>({date:r.date,status:r.status,summary:r.summary,error:r.error}))));
 if(all.some(x=>x.status!=='complete'))process.exitCode=1;
}finally{await browser.close();}
