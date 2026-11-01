// Full TEST tower A/B, identical scene and viewpoints, real postprocessing.
// SwiftShader is software WebGL; numbers MUST NOT be sold as native GPU FPS.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const url='http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
const params=new URLSearchParams({
 date:'2026-10-20',roomcull:'1',visibilitycells:'1',roomcullbench:'1'
});
const p=(xs,q)=>{if(!xs.length)return null;const a=[...xs].sort((a,b)=>a-b);return a[Math.floor((a.length-1)*q)]};
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const n=x=>Number.isFinite(x)?+x.toFixed(2):null;
try{
 const page=await browser.newPage({viewport:{width:1180,height:720},deviceScaleFactor:1,
  locale:'en-GB',timezoneId:'Europe/London'});
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(url+'?'+params,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!!window.__galleryStartupError||
  (!!window.__phiRoomCullBench?.spots()?.length&&!document.querySelector('#enter')?.disabled),
  null,{timeout:180000});
 const startupError=await page.evaluate(()=>window.__galleryStartupError);
 if(startupError)throw Error('TEST gallery failed to load '+startupError);
 await page.locator('#enter').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,null,{timeout:30000});
 await page.waitForFunction(()=>window.__phiRoomCullBench?.expectedPaintings()>0 &&
  window.__phiRoomCullBench.paintings()===window.__phiRoomCullBench.expectedPaintings(),
  null,{timeout:180000});
 await page.waitForTimeout(1800);
 const spots=await page.evaluate(()=>{
  const b=window.__phiRoomCullBench;
  return b.spots().map(p=>{
   b.move(p.room);
   b.setCulling(true);
   const standard=b.compiled(false);
   const indexed=b.compiled(true);
   if(JSON.stringify(standard.culledRooms)!==JSON.stringify(indexed.culledRooms)||
      standard.hidden!==indexed.hidden)throw Error('PVS and original visibility do not match at '+p.room);
   return {...p,hidden:indexed.hidden,compiled:indexed.visibilityCells};
  });
 });
 const chosen=[...spots].sort((a,b)=>b.hidden-a.hidden).slice(0,2);
 const samples=[];
 for(const spot of chosen){
  const modes=[];
  for(const compiled of [false,true,true,false]){
   await page.evaluate(({room,compiled})=>{
    const b=window.__phiRoomCullBench;
    b.move(room);b.setCulling(true);b.compiled(compiled);b.reset();
   },{room:spot.room,compiled});
   await page.waitForTimeout(1100);
   const frames=await page.evaluate(()=>window.__phiRoomCullBench.sample());
   modes.push({compiled,count:frames.length,
    renderP50Ms:n(p(frames.map(f=>f.ms),.5)),
    renderP95Ms:n(p(frames.map(f=>f.ms),.95)),
    sceneCalls:n(mean(frames.map(f=>f.sceneCalls))),
    sceneTriangles:n(mean(frames.map(f=>f.sceneTriangles))),
    hidden:n(mean(frames.map(f=>f.hidden)))});
  }
  samples.push({room:spot.room,originalHidden:spot.hidden,modes});
 }
 const totals={};
 for(const mode of [false,true]){
  const selected=samples.flatMap(s=>s.modes.filter(m=>m.compiled===mode&&m.count>0));
  totals[mode?'compiled':'baseline']={
   samples:selected.reduce((n,s)=>n+s.count,0),
   p50MeanMs:n(mean(selected.map(x=>x.renderP50Ms))),
   p95MeanMs:n(mean(selected.map(x=>x.renderP95Ms))),
   sceneCalls:n(mean(selected.map(x=>x.sceneCalls))),
   sceneTriangles:n(mean(selected.map(x=>x.sceneTriangles))),
   hidden:n(mean(selected.map(x=>x.hidden)))
  };
 }
 const report={date:'2026-10-20',status:'complete',environment:'GitHub Actions Ubuntu Chromium SwiftShader software WebGL',
  sameScene:true,methods:'ABBA PVS fast path versus original wall tests, two room viewpoints, unchanged full post-FX',
  spots:spots.map(({room,hidden})=>({room,hidden})),
  samples,totals,errors,
  caveat:'Software WebGL, short samples, not device FPS. Precomputed PVS and original culler must hide exactly the same objects.'};
 await mkdir('test/virtual-gallery',{recursive:true});
 await writeFile('test/virtual-gallery/pvs-browser-benchmark.json',JSON.stringify(report,null,2)+'\n');
 console.log('PVS_BROWSER_BENCH '+JSON.stringify(report));
 if(errors.length||!totals.compiled.samples||!totals.baseline.samples)
  process.exitCode=1;
}finally{await browser.close();}
