// TEST ONLY: six cross-over lift journeys. Same original gallery renderer,
 // artwork, lighting, shadows and 16-mesh reveal, variable is portalbatch only.
 // Runner Chromium SwiftShader is noisy; results are relative, not visitor FPS.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const cases=[
 {date:'2026-10-20',portalbatch:0},
 {date:'2026-10-20',portalbatch:1},
 {date:'2026-10-30',portalbatch:1},
 {date:'2026-10-30',portalbatch:0},
 {date:'2026-10-20',portalbatch:1},
 {date:'2026-10-20',portalbatch:0}
];
const results=[];
const summarize=values=>{
 const v=values.filter(Number.isFinite).sort((a,b)=>a-b);
 if(!v.length)return null;
 return {n:v.length,min:+v[0].toFixed(1),max:+v.at(-1).toFixed(1),
  mean:+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1)};
};
try{
 for(const [index,trial] of cases.entries()){
  const {date,portalbatch}=trial,mode=portalbatch?'portal-batch':'control';
  const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
   const record=window.__portalAuditFrames={active:false,frames:[],last:0};
   function sample(now){
    if(record.active&&record.last)record.frames.push(+(now-record.last).toFixed(1));
    record.last=now;
    requestAnimationFrame(sample);
   }
   requestAnimationFrame(sample);
  });
  const out={index:index+1,date,mode,portalbatch,status:'failed'};
  try{
   const query=new URLSearchParams({
    debug:'1',fx:'architectural',liftprofile:'1',liftbatch:'16',liftstage:'1',
    roomcull:'1',framebatch:'1',captionbatch:'1',roombatch:'0',
    revealcompile:'0',earlycompile:'0',shadowreceiverfast:'0',
    portalbatch:String(portalbatch)
   });
   await page.goto('http://127.0.0.1:4173/test/virtual-gallery/full-engine.html?'+query,
    {waitUntil:'domcontentloaded',timeout:65000});
   await page.waitForFunction(()=>window.__galleryStartupError||
    !document.querySelector('#enter')?.disabled,null,{timeout:180000});
   const startup=await page.evaluate(()=>window.__galleryStartupError||null);
   if(startup)throw Error('Startup: '+startup);
   await page.locator('#enter').evaluate(e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,
    null,{timeout:35000});
   await page.locator('#openLift').evaluate(e=>e.click());
   await page.locator('#liftMonth').evaluate((e,value)=>{
    e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));
   },date.slice(0,7));
   const button=page.locator('#liftDays button[title^="'+date+'"]');
   const title=await button.getAttribute('title',{timeout:15000});
   if(!title)throw Error('Floor not in calendar: '+date);
   await page.evaluate(()=>{const r=window.__portalAuditFrames;
    r.active=true;r.frames.length=0;r.last=0;});
   await button.evaluate(e=>e.click());
   await page.waitForFunction(()=>window.__phiLiftRide?.status==='opening'||window.__phiLiftError,
    null,{timeout:210000});
   const data=await page.evaluate(()=>{
    const profile=window.__phiLiftProfile?.visits?.at(-1);
    const stages=profile?.stages||[],at=name=>stages.find(s=>s.name===name)?.elapsedMs??null;
    const record=window.__portalAuditFrames;record.active=false;
    const frames=record.frames.filter(Number.isFinite).sort((a,b)=>a-b);
    const percentile=p=>frames.length?frames[Math.min(frames.length-1,Math.ceil(frames.length*p)-1)]:null;
    return {error:window.__phiLiftError||null,
     totalMs:profile?.summary?.ms??null,
     arrivalMs:at('ride-finished')!==null&&at('doors-opening')!==null
      ?at('doors-opening')-at('ride-finished'):null,
     frame:{count:frames.length,p95:percentile(.95),max:frames.at(-1)??null,
      over100:frames.filter(v=>v>=100).length},
     sceneRender:profile?.operations?.['postfx-pass:0:scene-render']||null,
     shadowRender:profile?.operations?.['shadow-map-render']||null,
     portal:window.__phiPortalFrameBatches||null,
     artwork:{expected:window.__phiFullEngine?.paintings,loaded:window.__phiFullEngine?.paintingsLoaded},
     postfx:{preset:window.__phiPostFX?.preset,active:window.__phiPostFX?.active,
      renderer:window.__phiPostFX?.renderer},
     frameBatches:window.__phiFrameBatches||null,
     captionBatches:window.__phiCaptionBatches||null,
     light:window.__phiLightingStudy?{
      shadowMaps:window.__phiLightingStudy.shadowMaps,
      casters:window.__phiLightingStudy.casters,
      refreshes:window.__phiLightingStudy.refreshes
     }:null
    };
   });
   Object.assign(out,data,{errors});
   if(data.error)throw Error('Lift: '+data.error);
   if(!Number.isFinite(data.totalMs)||!Number.isFinite(data.arrivalMs))
    throw Error('Missing lift timings');
   if(!data.artwork.expected||data.artwork.expected!==data.artwork.loaded)
    throw Error('Original paintings not fully loaded');
   if(data.postfx.preset!=='architectural'||data.postfx.active!==true||
      data.postfx.renderer!=='pmndrs')
    throw Error('Original architectural postprocessing not active');
   if(!data.portal||data.portal.active!==Boolean(portalbatch))
    throw Error('Portal opt-in not honored');
   if(portalbatch&&data.portal.savedDrawCalls<1)
    throw Error('No portal draw calls actually eliminated');
   if(errors.length)throw Error('Browser errors: '+errors.join('; '));
   out.status='complete';
   console.log('PORTAL_CROSS_TRIAL '+JSON.stringify({
    index:out.index,date,mode,totalMs:out.totalMs,arrivalMs:out.arrivalMs,
    frame:out.frame,scene:out.sceneRender,shadow:out.shadowRender,
    portal:out.portal,artwork:out.artwork,light:out.light}));
  }catch(e){
   out.failure=String(e);
   console.error('PORTAL_CROSS_FAILURE '+JSON.stringify({
    index:out.index,date,mode,error:out.failure,errors}));
  }finally{
   results.push(out);
   await page.close();
  }
 }
 const groups={};
 for(const trial of results){
  const entry=groups[trial.date]??={control:[],batched:[]};
  entry[trial.portalbatch?'batched':'control'].push(trial);
 }
 const byDate=Object.fromEntries(Object.entries(groups).map(([date,g])=>[
  date,Object.fromEntries(Object.entries(g).map(([mode,arr])=>[
   mode,{n:arr.length,completed:arr.filter(r=>r.status==='complete').length,
    totalMs:summarize(arr.map(r=>r.totalMs)),
    arrivalMs:summarize(arr.map(r=>r.arrivalMs)),
    worstFrameMs:summarize(arr.map(r=>r.frame?.max)),
    p95FrameMs:summarize(arr.map(r=>r.frame?.p95)),
    sceneTotalMs:summarize(arr.map(r=>r.sceneRender?.totalMs)),
    sceneMaxMs:summarize(arr.map(r=>r.sceneRender?.maxMs)),
    shadowTotalMs:summarize(arr.map(r=>r.shadowRender?.totalMs)),
    savedDrawCalls:summarize(arr.map(r=>r.portal?.savedDrawCalls))
   }
  ]))
 ]));
 const parity={
  allCompleted:results.length===cases.length&&results.every(r=>r.status==='complete'),
  everyModeOnEachDate:Object.values(groups).every(g=>g.control.length&&g.batched.length),
  allPaintingsLoaded:results.every(r=>r.artwork?.expected>0&&r.artwork.loaded===r.artwork.expected),
  architecturalPostFX:results.every(r=>r.postfx?.active&&r.postfx.preset==='architectural'&&r.postfx.renderer==='pmndrs'),
  onlyPortalBatched:results.every(r=>r.portal?.active===Boolean(r.portalbatch)),
  sourceOptionsMatch:Object.values(groups).every(g=>{
   const all=[...g.control,...g.batched];
   const pick=key=>all.every(r=>JSON.stringify(r[key])===JSON.stringify(all[0]?.[key]));
   // One merged draw call replaces N static, still-shadow-casting meshes.
   // The count of caster OBJECTS must fall by savedDrawCalls, even though
   // their original triangles and shadow coverage remain identical.
   const normalCasters=g.control[0]?.light?.casters;
   const shadowCount=g.control[0]?.light?.shadowMaps;
   return pick('artwork')&&pick('postfx')&&pick('frameBatches')&&pick('captionBatches')&&
    Number.isFinite(normalCasters)&&
    all.every(r=>r.light?.shadowMaps===shadowCount&&
     r.light?.casters===(r.portalbatch
      ?normalCasters-r.portal.savedDrawCalls
      :normalCasters));
  })
 };
 await mkdir('phi-portal-batch-crossover',{recursive:true});
 await writeFile('phi-portal-batch-crossover/results.json',JSON.stringify({
  version:1,environment:'Ubuntu GitHub Actions Chromium SwiftShader software GPU',
  note:'Six date-matched cross-over lift trials; software GPU results are directional only. Does not infer hardware FPS or full-scene pixel identity.',
  order:cases,parity,byDate,results
 },null,2));
 console.log('PORTAL_CROSS_SUMMARY '+JSON.stringify({parity,byDate,
  trials:results.map(r=>({i:r.index,date:r.date,mode:r.mode,status:r.status,
   totalMs:r.totalMs,arrivalMs:r.arrivalMs,worstMs:r.frame?.max}))}));
 if(Object.values(parity).some(x=>!x))process.exitCode=1;
}finally{await browser.close();}
