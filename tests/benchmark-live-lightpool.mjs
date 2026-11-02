// Automated A/B performance probe of the ACTUAL published gallery.
// Runs on GitHub Actions software WebGL: use for relative regression detection,
// not absolute FPS predictions for visitors with dedicated GPUs.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.PHI_BENCH_URL||'https://southernadd-cmyk.github.io/algoart/gallery/visit/';
const output='phi-live-benchmark-results';
const date=process.env.PHI_BENCH_DATE||'2026-10-31';
const order=(process.env.PHI_BENCH_ORDER||'on,off,off,on').split(',');
const round=n=>Math.round(n*10)/10;
const percentile=(xs,p)=>{
 if(!xs.length)return null;
 const sorted=[...xs].sort((a,b)=>a-b);
 return round(sorted[Math.floor((sorted.length-1)*p)]);
};
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle',
 '--use-angle=swiftshader','--disable-dev-shm-usage','--disable-background-timer-throttling'
]});
const results=[];
try{
 const context=await browser.newContext({viewport:{width:1000,height:650},deviceScaleFactor:1});
 for(let index=0;index<order.length;index++){
  const mode=order[index],page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const url=new URL(base);
  url.searchParams.set('debug','1');url.searchParams.set('liftprofile','1');
  url.searchParams.set('lightpool',mode==='on'?'1':'0');
  const item={run:index+1,mode,url:url.href,date,ok:false};
  try{
   await page.addInitScript(()=>{
    const sample={programs:0,shaderSources:0,uniformBlockingMs:0,
     maxUniformBlockingMs:0,slowUniformCalls:0,uniformQueries:0};
    window.__ppShaderBenchmark=sample;
    for(const Base of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
     if(!Base?.prototype)continue;
     const p=Base.prototype;
     for(const name of ['createProgram','shaderSource','getProgramParameter']){
      const desc=Object.getOwnPropertyDescriptor(p,name);
      if(!desc||typeof desc.value!=='function')continue;
      const original=desc.value;
      try{Object.defineProperty(p,name,{...desc,value:function(...args){
       const timed=name==='getProgramParameter'&&args[1]===this.ACTIVE_UNIFORMS;
       const started=timed?performance.now():0;
       const value=Reflect.apply(original,this,args);
       if(name==='createProgram'&&value)sample.programs++;
       if(name==='shaderSource')sample.shaderSources++;
       if(timed){
        const elapsed=performance.now()-started;
        sample.uniformQueries++;
        sample.uniformBlockingMs+=elapsed;
        sample.maxUniformBlockingMs=Math.max(sample.maxUniformBlockingMs,elapsed);
        if(elapsed>=20)sample.slowUniformCalls++;
       }
       return value;
      }});}catch{}
     }
    }
   });
   const start=Date.now();
   await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:90000});
   await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled ||
    !document.querySelector('#error')?.hidden || window.__galleryStartupError,
    null,{timeout:130000});
   item.startupMs=Date.now()-start;
   item.enterReady=await page.locator('#enter').isEnabled();
   if(!item.enterReady)throw Error('Failed to prepare gallery: '+await page.locator('#error').textContent());
   item.before=await page.evaluate(()=>({
    floor:window.__phiFullEngine?.date,
    bounded:window.__phiBoundedLightPool,
    error:window.__galleryStartupError,
    render:window.__phiRenderStats,
    webgl:(()=>{
     const gl=document.querySelector('#world')?.getContext('webgl2');
     if(!gl)return null;
     const ext=gl.getExtension('WEBGL_debug_renderer_info');
     return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
      vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};
    })()
   }));
   await page.locator('#enter').click({noWaitAfter:true});
   await page.locator('#openLift').click({noWaitAfter:true});
   await page.locator('#lift').waitFor({state:'visible',timeout:20000});
   await page.locator('#liftMonth').fill(date.slice(0,7));
   await page.locator('#liftMonth').dispatchEvent('change');
   const button=page.locator('#liftDays button').filter({hasText:new RegExp('^'+Number(date.slice(-2))+'$')});
   await button.waitFor({state:'visible',timeout:10000});
   // rAF gaps are captured through final arrival, including opening doors.
   await page.evaluate(()=>{
    const state={active:true,last:0,frames:[],start:performance.now()};
    window.__ppFrameBenchmark=state;
    const tick=at=>{
     if(!state.active)return;
     if(state.last)state.frames.push(at-state.last);
     state.last=at;
     requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
   });
   const rideStart=Date.now();
   await button.click({noWaitAfter:true});
   await page.waitForFunction(()=>window.__phiLiftRide?.status==='ready'||window.__phiLiftRide?.status==='failed',
    null,{timeout:150000});
   item.journeyMs=Date.now()-rideStart;
   item.after=await page.evaluate(()=>{
    window.__ppFrameBenchmark.active=false;
    return {
     floor:window.__phiFullEngine?.date,
     state:window.__phiLiftRide?.status,
     bounded:{...window.__phiBoundedLightPool},
     profiler:window.__phiLiftProfile?.visits?.at(-1)||null,
     shader:{...window.__ppShaderBenchmark},
     frames:window.__ppFrameBenchmark.frames,
     error:window.__phiLiftError||window.__galleryStartupError
    };
   });
   const frames=item.after.frames;
   item.frameStats={count:frames.length,p50Ms:percentile(frames,.5),p95Ms:percentile(frames,.95),
    p99Ms:percentile(frames,.99),maxMs:round(Math.max(0,...frames)),
    over33:frames.filter(n=>n>33.3).length,over100:frames.filter(n=>n>100).length,
    over250:frames.filter(n=>n>250).length};
   delete item.after.frames;
   item.after.shader.uniformBlockingMs=round(item.after.shader.uniformBlockingMs);
   item.after.shader.maxUniformBlockingMs=round(item.after.shader.maxUniformBlockingMs);
   item.ok=item.after.state==='ready'&&item.after.floor===date&&item.before.bounded?.enabled===(mode==='on');
   if(!item.ok)throw Error('Incorrect final state or lighting mode');
   await page.screenshot({path:`${output}/run-${index+1}-${mode}.png`,timeout:10000}).catch(()=>{});
  }catch(error){item.error=String(error?.stack||error);}
  finally{
   item.pageErrors=errors.slice(0,20);
   await writeFile(`${output}/run-${index+1}-${mode}.json`,JSON.stringify(item,null,2));
   console.log('PHI_LIVE_BENCH_RESULT '+JSON.stringify({
    run:item.run,mode:item.mode,ok:item.ok,startupMs:item.startupMs,
    journeyMs:item.journeyMs,frames:item.frameStats,
    shaders:item.after?.shader,profiler:item.after?.profiler?.summary,
    finalFloor:item.after?.floor,error:item.error||item.after?.error||null
   }));
   results.push(item);await page.close();
  }
 }
 await context.close();
}finally{await browser.close();}
const byMode=Object.fromEntries(['on','off'].map(mode=>{
 const subset=results.filter(x=>x.mode===mode&&x.ok);
 const avg=key=>subset.length?round(subset.reduce((sum,r)=>sum+key(r),0)/subset.length):null;
 return [mode,{runs:subset.length,startupMs:avg(x=>x.startupMs),
  journeyMs:avg(x=>x.journeyMs),p95FrameMs:avg(x=>x.frameStats.p95Ms),
  maxFrameMs:avg(x=>x.frameStats.maxMs),over100:avg(x=>x.frameStats.over100),
  programs:avg(x=>x.after.shader.programs),
  uniformBlockingMs:avg(x=>x.after.shader.uniformBlockingMs)}];
}));
const summary={purpose:'live published six-light pool on/off A/B, same build, software WebGL',
 date,base,order,completed:results.filter(x=>x.ok).length,total:results.length,
 environment:results.find(x=>x.before?.webgl)?.before?.webgl||null,byMode};
await writeFile(`${output}/summary.json`,JSON.stringify(summary,null,2));
console.log('PHI_LIVE_BENCH_SUMMARY '+JSON.stringify(summary));
if(summary.completed<2||!byMode.on.runs||!byMode.off.runs)process.exitCode=1;
