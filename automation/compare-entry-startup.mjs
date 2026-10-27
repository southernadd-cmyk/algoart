import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {relative,dirname} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const baseline=process.env.STARTUP_BASELINE||'da9f3097662eeac84f462c54cf824085a09bf77d';
const replaced=new Set(['gallery/visit/gallery-phi.js','gallery/visit/architectural-materials.mjs','gallery/visit/phi-model-assets.mjs','gallery/visit/reception-tile-preview.mjs','gallery/visit/reception-wall-material.mjs']);
const hooks=`
 const metrics=window.__liveStartupAudit={compiles:[],frames:[]};
 window.__benchWork=()=>({deferred:deferredGalleryJobs.length,artwork:artworkQueue.length+artworkActive});
 if(renderer){
  const originalCompile=renderer.compileAsync.bind(renderer);
  renderer.compileAsync=async(...args)=>{const at=performance.now();try{return await originalCompile(...args);}finally{metrics.compiles.push({at,ms:performance.now()-at,kind:args[0].isScene?'scene':'model',programs:renderer.info.programs.length});}};
  const originalRender=renderer.render.bind(renderer);let nesting=0,last=0;
  renderer.render=(...args)=>{const outer=nesting++===0,now=performance.now();try{return originalRender(...args);}finally{nesting--;if(outer){metrics.frames.push({at:now,ms:last?now-last:0,programs:renderer.info.programs.length});last=now;if(metrics.frames.length>3000)metrics.frames.shift();}}};
 }
`;
await mkdir('live-startup-results',{recursive:true});
const bundles={};
for(const variant of ['baseline','candidate']){
 const result=await build({entryPoints:['gallery/visit/gallery-phi.js'],bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',write:false,
  plugins:[{name:'comparison-instrumentation',setup(builder){builder.onLoad({filter:/\.(mjs|js)$/},async({path})=>{
   const file=relative(process.cwd(),path).replaceAll('\\','/');
   if(!replaced.has(file))return;
   let source=variant==='baseline'?execFileSync('git',['show',baseline+':'+file],{encoding:'utf8'}):await readFile(path,'utf8');
   if(file==='gallery/visit/gallery-phi.js')source=source.replace('const galleryFinish=createArchitecturalMaterials',hooks+'\nconst galleryFinish=createArchitecturalMaterials');
   return {contents:source,loader:'js',resolveDir:dirname(path)};
  });}}]});bundles[variant]=result.outputFiles[0].text;
}
const records=[];
for(const [index,variant] of (process.env.ENTRY_CANDIDATE_ONLY?['candidate']:['baseline','candidate']).entries()){
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:960,height:600}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/gallery/visit/gallery-phi-bundle.js*',route=>route.fulfill({contentType:'text/javascript',body:bundles[variant]}));
  await page.addInitScript(()=>{
   window.__readyAt=0;window.__entryAt=0;window.__liveLongTasks=[];
   document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target?.id==='enter')window.__entryAt=performance.now();},{capture:true});
   new PerformanceObserver(list=>{for(const e of list.getEntries())window.__liveLongTasks.push({at:e.startTime,ms:e.duration});}).observe({type:'longtask',buffered:true});
   const observer=new MutationObserver(()=>{const button=document.getElementById('enter');if(button&&!button.disabled&&!window.__readyAt){window.__readyAt=performance.now();observer.disconnect();}});
   observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
  });
  await page.goto('http://127.0.0.1:4173/gallery/visit/?debug',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__readyAt>0,{timeout:120000});
  const ready=await capture(page);
  await page.locator('#enter').press('Enter');
  const enteredAt=await page.evaluate(()=>window.__entryAt);
  assert.ok(enteredAt>0);
  await page.keyboard.down('w');
  await page.waitForTimeout(6000);
  await page.keyboard.up('w');
  const early=await capture(page);
  let settled=true;
  try{await page.waitForFunction(()=>{
   const work=window.__benchWork(),p=window.__phiPreparation,s=window.__phiLiftState;
   return work.deferred===0&&s?.outdoorPlantsLoaded===8&&s.propsLoaded===3&&s.deskPropsLoaded===2&&s.entranceModelLoaded&&
    (!p||(p.models.active===0&&p.models.completed+p.models.failed===p.models.queued&&p.textures.active===0&&p.textures.completed+p.textures.failed===p.textures.queued));
  },{timeout:90000});}catch{settled=false;}
  const final=await capture(page);
  const record={index,variant,baseline,softwareRendering:true,ready,enteredAt,early,final,settled,errors};
  records.push(record);await writeFile('live-startup-results/results.json',JSON.stringify(records,null,2));
  console.log('STARTUP',JSON.stringify({index,variant,readyMs:ready.readyAt,initialCompile:ready.metrics.compiles.find(c=>c.kind==='scene'),earlyFrames:summarise(early.metrics.frames.filter(f=>f.at>=enteredAt).map(f=>f.ms)),postEntryLongTaskMs:early.longTasks.filter(t=>t.at>=enteredAt).reduce((n,t)=>n+t.ms,0),entryPreparation:early.entryPreparation,earlyModels:early.state,earlyPreparation:early.preparation,settled,settledAt:final.at,programs:final.metrics.frames.at(-1)?.programs,errors}));
  assert.deepEqual(errors,[]);assert.equal(settled,true,'Full-quality reception assets must finish, not remain hidden in a queue');
  if(variant==='candidate'){assert.equal(ready.entryPreparation.complete,true);assert.equal(ready.entryPreparation.timedOut,false);assert.equal(ready.entryPreparation.pending,0);}
 }finally{await browser.close();}
}
async function capture(page){return page.evaluate(()=>({at:performance.now(),readyAt:window.__readyAt,metrics:window.__liveStartupAudit,longTasks:window.__liveLongTasks,render:window.__phiRenderStats,state:window.__phiLiftState,entryPreparation:window.__phiEntryPreparation,preparation:window.__phiPreparation,work:window.__benchWork()}));}
function summarise(samples){const a=[...samples].sort((a,b)=>a-b);return {count:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.min(a.length-1,Math.floor(a.length*.95))]};}
