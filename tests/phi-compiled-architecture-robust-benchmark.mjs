// Real TEST 3-way A/B on a fixed archive. Avoid single-frame cold-shader
// samples: two independent browser visits each (ABCCBA) and warmed repetitions.
// SwiftShader software WebGL is useful only for relative regression evidence.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const target='http://127.0.0.1:4173/test/virtual-gallery/full-engine.html';
const date='2026-10-20',order=['original','precompiled','streamed','streamed','precompiled','original'];
const args={original:'compiledarch=0&roomstream=0',
 precompiled:'compiledarch=1&roomstream=0',streamed:'compiledarch=1&roomstream=1'};
const safe=x=>Number.isFinite(x)?+x.toFixed(2):null;
const quantile=(values,q)=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b);
 return a.length?a[Math.floor((a.length-1)*q)]:null;};
const med=values=>quantile(values,.5);
const root='phi-compiled-architecture-robust';
await mkdir(root,{recursive:true});
const results=[],baselines=new Map();
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
try{
 for(let run=0;run<order.length;run++){
  const mode=order[run],errors=[],context=await browser.newContext({
   viewport:{width:960,height:600},deviceScaleFactor:1,
   locale:'en-GB',timezoneId:'Europe/London'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(String(error)));
  let record={mode,run:run+1,status:'failed'};
  try{
   const since=Date.now();
   await page.goto(target+'?date='+date+'&roomcullbench=1&'+args[mode],
    {waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__galleryStartupError||
    (!!window.__phiRoomCullBench?.spots()?.length&&!document.querySelector('#enter')?.disabled),
    null,{timeout:180000});
   const startupError=await page.evaluate(()=>window.__galleryStartupError);
   if(startupError)throw Error('Startup failed: '+startupError);
   await page.locator('#enter').evaluate(el=>el.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,
    null,{timeout:25000});
   await page.waitForFunction(()=>window.__phiRoomCullBench?.expectedPaintings()>0&&
    window.__phiRoomCullBench.paintings()===window.__phiRoomCullBench.expectedPaintings(),
    null,{timeout:120000});
   await page.waitForTimeout(1000);
   const startupMs=Date.now()-since;
   const before=await page.evaluate(()=>({
    state:window.__phiCompiledArchitecture?.(),
    roomCount:window.__phiRoomCullBench?.spots()?.length||0
   }));
   if(before.roomCount!==4)throw Error('Unexpected room count '+before.roomCount);
   if(mode!=='original'&&(!before.state?.active||!before.state.shared))
    throw Error('Compiled mode was not active with shared architecture');
   if(mode==='precompiled'&&(before.state.loaded!==4||before.state.replaced!==4))
    throw Error('Eager precompiled floor did not load all four rooms');
   const views=[];
   for(const room of [0,3]){
    await page.evaluate(room=>{
     const b=window.__phiRoomCullBench;b.move(room);b.setCulling(false);
    },room);
    await page.waitForTimeout(400);
    // Collect full composer render samples after movement and preparation.
    await page.evaluate(()=>window.__phiRoomCullBench.reset());
    await page.waitForTimeout(1800);
    const fx=await page.evaluate(()=>window.__phiRoomCullBench.sample());
    // Remove shader warmup from the direct 3D scene render timing.
    await page.evaluate(()=>window.__phiRoomCullBench.directSceneRender());
    const snapshot=await page.evaluate(()=>{
     const bench=window.__phiRoomCullBench,frames=[];
     for(let i=0;i<4;i++)frames.push(bench.directSceneRender());
     return {frames,png:document.querySelector('#world').toDataURL('image/png'),
      compiled:window.__phiCompiledArchitecture?.()};
    });
    const png=Buffer.from(snapshot.png.split(',')[1],'base64');
    const hash=createHash('sha256').update(png).digest('hex');
    const key='room-'+room;
    if(!baselines.has(key))baselines.set(key,snapshot.png);
    let difference=null;
    if(run>0){
     difference=await page.evaluate(async original=>{
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=original;});
      const canvas=document.querySelector('#world');
      const base=document.createElement('canvas');base.width=canvas.width;base.height=canvas.height;
      const ctx=base.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      const a=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const present=document.createElement('canvas');present.width=canvas.width;present.height=canvas.height;
      const cc=present.getContext('2d',{willReadFrequently:true});cc.drawImage(canvas,0,0);
      const b=cc.getImageData(0,0,canvas.width,canvas.height).data;
      let changed=0,changedChannels=0,maxChannelDelta=0,sumDelta=0;
      for(let i=0;i<a.length;i+=4){
       let differs=false;
       for(let c=0;c<4;c++){
        const delta=Math.abs(a[i+c]-b[i+c]);
        if(delta){differs=true;changedChannels++;sumDelta+=delta;maxChannelDelta=Math.max(maxChannelDelta,delta);}
       }
       if(differs)changed++;
      }
      return {pixels:canvas.width*canvas.height,changedPixels:changed,
       changedPercent:+(100*changed/(canvas.width*canvas.height)).toFixed(5),
       changedChannels,maxChannelDelta,sumDelta};
     },baselines.get(key));
    }
    await writeFile(root+'/run-'+(run+1)+'-'+mode+'-room-'+room+'.png',png);
    const renderMs=snapshot.frames.map(f=>f.ms);
    views.push({room,renderCount:renderMs.length,sceneRenderP50Ms:safe(med(renderMs)),
     sceneRenderP95Ms:safe(quantile(renderMs,.95)),sceneRenderMaxMs:safe(Math.max(...renderMs)),
     fullFxFrames:fx.length,fullFxP50Ms:safe(med(fx.map(f=>f.ms))),
     fullFxP95Ms:safe(quantile(fx.map(f=>f.ms),.95)),
     sceneCalls:snapshot.frames.at(-1).calls,triangles:snapshot.frames.at(-1).triangles,
     hidden:snapshot.frames.at(-1).hidden,hash,difference,compiled:snapshot.compiled});
   }
   if(errors.length)throw Error('JS errors: '+errors.join('; ').slice(0,300));
   record={mode,run:run+1,status:'complete',startupMs,views,errors};
   console.log('COMPILED_ARCH_ROBUST_RUN '+JSON.stringify({
    mode,run:run+1,startupMs,views:views.map(({room,sceneRenderP50Ms,
     sceneRenderP95Ms,sceneCalls,triangles,difference,compiled})=>({
      room,sceneRenderP50Ms,sceneRenderP95Ms,sceneCalls,triangles,difference,compiled
     }))
   }));
  }catch(error){record={...record,status:'failed',error:String(error),errors};
   console.error('COMPILED_ARCH_ROBUST_FAILURE '+JSON.stringify(record));}
  results.push(record);
  await context.close();
 }
 const summary=Object.fromEntries(Object.keys(args).map(mode=>{
  const rows=results.filter(r=>r.mode===mode&&r.status==='complete');
  return [mode,{runs:rows.length,loadMsMedian:safe(med(rows.map(r=>r.startupMs))),
   byRoom:[0,3].map(room=>{
    const selected=rows.map(r=>r.views.find(v=>v.room===room)).filter(Boolean);
    return {room,sceneP50MsMedian:safe(med(selected.map(x=>x.sceneRenderP50Ms))),
     sceneP95MsMedian:safe(med(selected.map(x=>x.sceneRenderP95Ms))),
     callsMedian:safe(med(selected.map(x=>x.sceneCalls))),
     trianglesMedian:safe(med(selected.map(x=>x.triangles))),
     differences:selected.map(x=>x.difference)};
   })}];
 }));
 const originalDrift=summary.original.byRoom.flatMap(x=>x.differences.filter(Boolean));
 const stableOriginal=originalDrift.every(x=>x.changedPixels===0);
 const parity=results.filter(r=>r.mode!=='original'&&r.status==='complete')
  .flatMap(r=>r.views.map(v=>({
   run:r.run,mode:r.mode,room:v.room,changedPercent:v.difference?.changedPercent,
   changedPixels:v.difference?.changedPixels,exact:v.difference?.changedPixels===0
  })));
 const report={date,environment:'Ubuntu Chromium SwiftShader (software WebGL)',
  method:'ABCCBA: two independent visits per mode; same floor, two viewpoints; four warmed direct scene frames per viewpoint; per-pixel PNG comparisons and short full-postFX frame sampling',
  summary,stableOriginal,originalDrift,parity,results,
  warnings:['Software-rendered measurements are not native GPU FPS',
   'Dynamic artwork, lights or deferred loads can change across independent sessions',
   'If baseline differs from itself, cross-mode image parity is inconclusive',
   'This is an architectural experiment, not entire-gallery scene streaming']};
 await writeFile(root+'/results.json',JSON.stringify(report,null,2)+'\n');
 console.log('COMPILED_ARCH_ROBUST_SUMMARY '+JSON.stringify({
  summary,stableOriginal,parity:parity.map(x=>({mode:x.mode,room:x.room,changedPercent:x.changedPercent})),
  completed:results.filter(r=>r.status==='complete').length
 }));
 if(results.some(r=>r.status!=='complete'))process.exitCode=1;
}finally{await browser.close();}
