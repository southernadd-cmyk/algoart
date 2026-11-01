// TEST-only real gallery A/B. Geometry parity is unit-tested separately.
// Headless Chromium uses SwiftShader: timings indicate relative regressions,
// not real hardware GPU frame times. Always save a report, even on failure.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
const modes=[
 {name:'original',query:'compiledarch=0&roomstream=0'},
 {name:'precompiled',query:'compiledarch=1&roomstream=0'},
 {name:'streamed',query:'compiledarch=1&roomstream=1'}
];
const date='2026-10-20',results=[];
const n=x=>Number.isFinite(x)?+x.toFixed(2):null;
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
try{
 for(const mode of modes){
  const context=await browser.newContext({viewport:{width:980,height:600},deviceScaleFactor:1,
   locale:'en-GB',timezoneId:'Europe/London'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  let report={mode:mode.name,status:'failed'};
  try{
   const begun=Date.now();
   const url=root+'?date='+date+'&roomcullbench=1&'+mode.query;
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__galleryStartupError||
    (window.__phiRoomCullBench?.spots()?.length>0&&!document.querySelector('#enter')?.disabled),
    null,{timeout:180000});
   const startup=await page.evaluate(()=>window.__galleryStartupError||null);
   if(startup)throw Error('Gallery startup failed: '+startup);
   await page.locator('#enter').evaluate(el=>el.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,
    null,{timeout:20000});
   await page.waitForFunction(()=>window.__phiRoomCullBench?.expectedPaintings()>0&&
    window.__phiRoomCullBench.paintings()===window.__phiRoomCullBench.expectedPaintings(),
    null,{timeout:120000});
   await page.waitForTimeout(1500);
   const startupMs=Date.now()-begun;
   const spots=await page.evaluate(()=>window.__phiRoomCullBench.spots());
   if(mode.name==='precompiled'){
    await page.waitForFunction(()=>window.__phiCompiledArchitecture?.().remaining===0,
     null,{timeout:20000});
   }
   const captures=[];
   for(const room of [0,3]){
    await page.evaluate(room=>{
     const b=window.__phiRoomCullBench;b.move(room);b.setCulling(false);
    },room);
    await page.waitForTimeout(800);
    const data=await page.evaluate(()=>{
     const b=window.__phiRoomCullBench;
     // The same direct scene render and readback; no post-FX alterations.
     const render=b.directSceneRender();
     const png=document.getElementById('world').toDataURL('image/png');
     return {render,png,compiled:window.__phiCompiledArchitecture?.()};
    });
    const bytes=Buffer.from(data.png.split(',')[1]||'','base64');
    await mkdir('phi-compiled-architecture-benchmark',{recursive:true});
    await writeFile('phi-compiled-architecture-benchmark/'+mode.name+'-room-'+room+'.png',bytes);
    captures.push({room,...data.render,imageHash:createHash('sha256').update(bytes).digest('hex'),
     imageBytes:bytes.length,compiled:data.compiled});
   }
   const stats=await page.evaluate(()=>({
    compiled:window.__phiCompiledArchitecture?.()||null,
    scene:window.__phiFullEngine||null,
    pageErrors:window.__galleryStartupError||null
   }));
   report={mode:mode.name,status:'complete',startupMs,rooms:spots.length,captures,stats,errors};
   if(mode.name!=='original'&&stats.compiled?.active!==true)
    throw Error('Precompiled package not active; test would be measuring fallback');
   if(mode.name==='precompiled'&&(stats.compiled?.remaining!==0||!stats.compiled?.shared))
    throw Error('Eager precompiled mode has not loaded all rooms and shared walls');
   if(errors.length)throw Error('JavaScript errors: '+errors.join('; ').slice(0,400));
   console.log('PHI_ARCH_AUDIT '+JSON.stringify({mode:mode.name,startupMs,
    compiled:stats.compiled,captures:captures.map(({room,ms,calls,triangles,imageHash})=>
     ({room,ms:n(ms),calls,triangles,imageHash}))}));
  }catch(error){
   report={...report,status:'failed',error:String(error),errors};
   console.error('PHI_ARCH_FAILURE '+JSON.stringify(report));
  }
  results.push(report);
  await context.close();
 }
 const original=results.find(r=>r.mode==='original');
 const precompiled=results.find(r=>r.mode==='precompiled');
 const parity=(original?.status==='complete'&&precompiled?.status==='complete')
  ?original.captures.map((capture,i)=>({
    room:capture.room,exactPng:!!capture.imageBytes&&
     capture.imageHash===precompiled.captures[i]?.imageHash,
    originalCalls:capture.calls,compiledCalls:precompiled.captures[i]?.calls,
    originalTriangles:capture.triangles,compiledTriangles:precompiled.captures[i]?.triangles
   })):null;
 const report={date,
  environment:'GitHub Actions Chromium SwiftShader software WebGL',
  warning:'Short sequential browser runs; do not use for native hardware frame-rate claims',
  method:'Original versus full precompiled versus spatial room streaming, identical archive floor and camera positions, direct scene renders plus PNG hashes',
  results,parity,allComplete:results.every(r=>r.status==='complete'),
  geometryParityCheckedSeparately:true};
 await writeFile('phi-compiled-architecture-benchmark/results.json',JSON.stringify(report,null,2)+'\n');
 console.log('PHI_ARCH_BROWSER_SUMMARY '+JSON.stringify({
  complete:report.allComplete,parity,
  runs:results.map(r=>({mode:r.mode,status:r.status,startupMs:r.startupMs,
   compiled:r.stats?.compiled,error:r.error}))
 }));
 if(!report.allComplete)process.exitCode=1;
}finally{await browser.close();}
