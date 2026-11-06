// Controlled r180/r187 comparison of one unmodified PROPORTION PIECE gallery snapshot.
// Run on a locally served checkout: no public-site writes, no live changes.
// Software WebGL timings are RELATIVE diagnostics, not Quest/mobile FPS predictions.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.PHI_TEST_SERVER || 'http://127.0.0.1:4173';
const OUT='three-r187-benchmark-results';
const ORDER=['r180','r187'];
const FILE={r180:'three-benchmark-r180.html',r187:'three-benchmark-r187.html'};
const TARGET=process.env.PHI_BENCH_DATE || '2026-10-31';
const round=x=>Number.isFinite(x)?+x.toFixed(1):null;
const percentile=(a,p)=>{
  if(!a.length)return null;
  const sorted=[...a].sort((x,y)=>x-y);
  return round(sorted[Math.floor((sorted.length-1)*p)]);
};
const stats=a=>({
  count:a.length,p50:percentile(a,.5),p95:percentile(a,.95),p99:percentile(a,.99),
  worst:round(Math.max(0,...a)),over50:a.filter(x=>x>=50).length,
  over100:a.filter(x=>x>=100).length,over250:a.filter(x=>x>=250).length
});
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage',
  '--disable-background-timer-throttling'
]});
const all=[];
try{
  for(let i=0;i<ORDER.length;i++){
    const revision=ORDER[i],run=i+1;
    // Each run gets a new isolated browser context: no HTTP texture/script cache
    // survives between runs. Single A/B smoke test; additional alternating runs follow only if both pass.
    const context=await browser.newContext({viewport:{width:1280,height:800},
      deviceScaleFactor:1,serviceWorkers:'block'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error'&&errors.length<30)errors.push('console: '+m.text());});
    const record={revision,run,environment:'Chromium SwiftShader software WebGL',date:TARGET,
      ok:false,pageErrors:errors};
    try{
      await page.addInitScript(()=>{
        const b=window.__threeBench={active:false,frames:[],longTasks:[],
          last:0,programs:0,shaderSources:0,uniformQueries:0,
          worstUniformQueryMs:0,totalUniformQueryMs:0};
        try{
          new PerformanceObserver(list=>{
            if(b.active)for(const entry of list.getEntries()){
              b.longTasks.push({at:entry.startTime,ms:entry.duration});
            }
          }).observe({entryTypes:['longtask']});
        }catch{}
        for(const Base of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
          const proto=Base?.prototype;
          if(!proto)continue;
          for(const name of ['createProgram','shaderSource','getProgramParameter']){
            const desc=Object.getOwnPropertyDescriptor(proto,name);
            if(typeof desc?.value!=='function')continue;
            try{Object.defineProperty(proto,name,{...desc,value:function(...args){
              const uniform=name==='getProgramParameter'&&args[1]===this.ACTIVE_UNIFORMS;
              const started=uniform?performance.now():0;
              const value=Reflect.apply(desc.value,this,args);
              if(name==='createProgram'&&value)b.programs++;
              if(name==='shaderSource')b.shaderSources++;
              if(uniform){
                const elapsed=performance.now()-started;
                b.uniformQueries++;
                b.totalUniformQueryMs+=elapsed;
                b.worstUniformQueryMs=Math.max(b.worstUniformQueryMs,elapsed);
              }
              return value;
            }});}catch{}
          }
        }
        const frame=t=>{
          if(b.active&&b.last>0)b.frames.push(t-b.last);
          b.last=t;requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const started=performance.now();
      const url=BASE+'/gallery/visit/'+FILE[revision]+'?debug=1&liftprofile=1';
      record.url=url;
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
      await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled ||
        !!window.__galleryStartupError || !document.querySelector('#error')?.hidden,
        null,{timeout:90000});
      record.readyMs=round(performance.now()-started);
      const startup=await page.evaluate(()=>window.__galleryStartupError||null);
      if(startup)throw Error('Startup error: '+startup);
      if(!await page.locator('#enter').isEnabled())throw Error('Enter unavailable');
      record.reportedRevision=await page.evaluate(()=>window.__THREE__ ?? null);
      await page.locator('#enter').evaluate(el=>el.click());
      await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true &&
        window.__phiLiftState?.floor===0,null,{timeout:45000});
      record.startupState=await page.evaluate(()=>({
        revision:window.__THREE__ ?? null,renderer:window.__phiRenderStats||null
      }));
      // Collect room idle frame timing separately from the lift journey.
      await page.evaluate(()=>{const b=window.__threeBench;
        b.active=true;b.frames=[];b.longTasks=[];b.last=0;});
      await page.waitForTimeout(2500);
      record.reception=await page.evaluate(()=>{const b=window.__threeBench;
        b.active=false;return {frames:b.frames,longTasks:b.longTasks};});
      record.reception.frames=stats(record.reception.frames);

      await page.locator('#openLift').evaluate(el=>el.click());
      await page.waitForFunction(()=>document.querySelector('#lift')?.hidden===false,
        null,{timeout:30000});
      await page.locator('#liftMonth').evaluate((el,m)=>{
        el.value=m;el.dispatchEvent(new Event('change',{bubbles:true}));
      },TARGET.slice(0,7));
      const selector='#liftDays button[title^="'+TARGET+'"]';
      const button=page.locator(selector);
      const title=await button.getAttribute('title',{timeout:20000});
      const floor=Number(title?.match(/floor (\d+)/)?.[1]);
      if(!Number.isFinite(floor)||floor<1)throw Error('Missing requested floor: '+title);
      record.floor=floor;
      await page.evaluate(()=>{const b=window.__threeBench;
        b.active=true;b.frames=[];b.longTasks=[];b.last=0;});
      const liftStart=performance.now();
      await button.evaluate(el=>el.click());
      await page.waitForFunction(({floor,date})=>{
        const ride=window.__phiLiftRide,state=window.__phiLiftState;
        return (ride?.status==='ready'&&state?.floor===floor &&
          state?.date===date&&!state?.travelling)||!!window.__phiLiftError;
      },{floor,date:TARGET},{timeout:125000});
      record.liftMs=round(performance.now()-liftStart);
      const after=await page.evaluate(()=>{
        const b=window.__threeBench;b.active=false;
        const gl=document.querySelector('#world')?.getContext('webgl2');
        const debug=gl?.getExtension('WEBGL_debug_renderer_info');
        const renderer=gl?(debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)):null;
        return {
          frames:b.frames,longTasks:b.longTasks,shader:{
            programs:b.programs,shaderSources:b.shaderSources,
            uniformQueries:b.uniformQueries,
            totalUniformQueryMs:b.totalUniformQueryMs,
            worstUniformQueryMs:b.worstUniformQueryMs
          },
          gpu:renderer,profile:window.__phiLiftProfile?.visits?.at(-1)||null,
          state:window.__phiLiftState,ride:window.__phiLiftRide,
          error:window.__phiLiftError||null,
          art:window.__phiFullEngine||null,
          render:window.__phiRenderStats||null
        };
      });
      record.liftFrames=stats(after.frames);
      record.longTasks=after.longTasks.sort((a,b)=>b.ms-a.ms).slice(0,15);
      record.shader={...after.shader,
        totalUniformQueryMs:round(after.shader.totalUniformQueryMs),
        worstUniformQueryMs:round(after.shader.worstUniformQueryMs)};
      record.gpu=after.gpu;
      record.profileSummary=after.profile?.summary||null;
      record.stages=(after.profile?.stages||[]).map(x=>({
        name:x.name,elapsedMs:x.elapsedMs,details:x.details||null
      }));
      record.artwork={expected:after.art?.paintings??null,loaded:after.art?.paintingsLoaded??null};
      record.endState={date:after.state?.date,floor:after.state?.floor,
        status:after.ride?.status,error:after.error};
      record.ok=!after.error&&record.endState.status==='ready'&&
        record.endState.floor===floor&&record.endState.date===TARGET&&
        record.artwork.expected>0&&record.artwork.loaded===record.artwork.expected;
      if(!record.ok)throw Error('Journey or artwork readiness mismatch: '+JSON.stringify(record.endState));
      await page.screenshot({path:OUT+'/run-'+run+'-'+revision+'.png',timeout:20000});
    }catch(e){
      record.error=String(e?.stack||e);
      try{await page.screenshot({path:OUT+'/run-'+run+'-'+revision+'-failure.png'});}catch{}
    }finally{
      await writeFile(OUT+'/run-'+run+'-'+revision+'.json',JSON.stringify(record,null,2));
      all.push(record);
      console.log('THREE_BENCH_RUN '+JSON.stringify({
        revision,run,ok:record.ok,readyMs:record.readyMs,liftMs:record.liftMs,
        liftFrames:record.liftFrames,shader:record.shader,artwork:record.artwork,
        error:record.error||null,pageErrors:record.pageErrors?.slice(0,4)
      }));
      await context.close();
    }
  }
}finally{await browser.close();}
const mean=(a,k)=>a.length?round(a.reduce((s,r)=>s+(k(r)??0),0)/a.length):null;
const summaries=Object.fromEntries(['r180','r187'].map(rev=>{
  const a=all.filter(x=>x.revision===rev&&x.ok);
  return [rev,{passes:a.length,runs:all.filter(x=>x.revision===rev).length,
    readyMs:mean(a,r=>r.readyMs),liftMs:mean(a,r=>r.liftMs),
    receptionP95:mean(a,r=>r.reception?.frames.p95),
    liftP95:mean(a,r=>r.liftFrames?.p95),
    worstFrame:mean(a,r=>r.liftFrames?.worst),
    stallsOver100:mean(a,r=>r.liftFrames?.over100),
    shaderPrograms:mean(a,r=>r.shader?.programs),
    worstUniformQueryMs:mean(a,r=>r.shader?.worstUniformQueryMs)
  }];
}));
const pct=(key)=>summaries.r180[key]&&summaries.r187[key]!=null?
  round(100*(summaries.r187[key]-summaries.r180[key])/summaries.r180[key]):null;
const report={purpose:'Same live code and assets; Three.js 0.180.0 versus 0.187.0',
  environment:'GitHub Actions Chromium SwiftShader software WebGL',
  testDate:TARGET,order:ORDER,source:'single main-branch snapshot',
  summaries,percentChangeR187MinusR180:{
    readyMs:pct('readyMs'),liftMs:pct('liftMs'),liftP95:pct('liftP95'),
    worstFrame:pct('worstFrame'),shaderPrograms:pct('shaderPrograms')
  },allPassed:all.every(x=>x.ok),results:all};
await writeFile(OUT+'/summary.json',JSON.stringify(report,null,2));
console.log('THREE_BENCH_SUMMARY '+JSON.stringify({...report,results:undefined}));
if(!report.allPassed||summaries.r180.passes!==1||summaries.r187.passes!==1)process.exitCode=1;
