import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {instrumentPhiSource} from './build-phi-post-test.mjs';
import {fileURLToPath} from 'node:url';

// Diagnostic build only. Keep rendering decisions identical to the candidate.
await build({entryPoints:['gallery/visit/gallery-phi-test.js'],bundle:true,minify:true,keepNames:true,
 format:'esm',platform:'browser',target:'es2022',outfile:'gallery/visit/gallery-phi-post-test-bundle.js',
 plugins:[{name:'startup-audit',setup(builder){
  builder.onLoad({filter:/[/\\]gallery-phi\.js$/},async({path})=>{
   let source=instrumentPhiSource(await readFile(path,'utf8'));
   source=source.replace('function processDeferredGallery(){',`function processDeferredGallery(){
    if(window.__phiAudit)window.__phiAudit.deferredRuns++;
   `);
   return {contents:source,loader:'js',resolveDir:fileURLToPath(new URL('../gallery/visit/',import.meta.url))};
  });
  builder.onLoad({filter:/[/\\]phi-shadows\.mjs$/},async({path})=>{
   let source=await readFile(path,'utf8');
   source=source.replace('lastScan=now;scene.updateMatrixWorld(true);',`const scanStarted=performance.now();
    lastScan=now;scene.updateMatrixWorld(true);`);
   source=source.replace('material.needsUpdate=true;',`{material.needsUpdate=true;stats.materialInvalidations=(stats.materialInvalidations||0)+1;}`);
   source=source.replace('stats.roomLights=slots.filter(s=>s.light).length;stats.casters=casters;',`stats.roomLights=slots.filter(s=>s.light).length;stats.casters=casters;
    const ms=performance.now()-scanStarted;
    stats.scanCount=(stats.scanCount||0)+1;stats.scanTotalMs=(stats.scanTotalMs||0)+ms;
    stats.scanMaxMs=Math.max(stats.scanMaxMs||0,ms);`);
   return {contents:source,loader:'js',resolveDir:fileURLToPath(new URL('../test/virtual-gallery/',import.meta.url))};
  });
  builder.onLoad({filter:/[/\\]phi-postprocessing\.mjs$/},async({path})=>{
   let source=await readFile(path,'utf8');
   source=source.replace('const params=new URLSearchParams(location.search);',`const params=new URLSearchParams(location.search);
    const audit=window.__phiAudit={deferredRuns:0,compiles:[],renders:[],programs:[]};
    const compile=renderer.compileAsync.bind(renderer);
    renderer.compileAsync=async(...args)=>{const start=performance.now();try{return await compile(...args);}finally{audit.compiles.push({at:start,ms:performance.now()-start,programs:renderer.info.programs.length});}};
   `);
   source=source.replace('const now=performance.now();\n  shadows?.update(now);',`const now=performance.now();
    if(audit.renders.length<3000)audit.renders.push({at:now,refresh:shadows?.stats.mapRefreshes||0,programs:renderer.info.programs.length,deferredRuns:audit.deferredRuns});
    shadows?.update(now);`);
   return {contents:source,loader:'js',resolveDir:fileURLToPath(new URL('../test/virtual-gallery/',import.meta.url))};
  });
 }}]});

await mkdir('phi-startup-audit',{recursive:true});
const cases=[['baseline',0],['shadows',1],['shadows',1],['baseline',0]];
const results=[];
for(let index=Number(process.env.PHI_AUDIT_START||0);index<cases.length;index++){
 const [name,shadows]=cases[index];
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:960,height:600}}),page=await context.newPage();
  const errors=[],logs=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/Gallery performance|Gallery startup|Post test/.test(m.text()))logs.push(m.text());});
  page.on('requestfinished',request=>{requests.push({url:request.url().replace('http://127.0.0.1:4173/',''),timing:request.timing()});});
  await page.addInitScript(()=>{
   window.__auditLongTasks=[];
   new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__auditLongTasks.push({at:entry.startTime,ms:entry.duration});}).observe({type:'longtask',buffered:true});
  });
  const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  await page.goto(`http://127.0.0.1:4173/test/virtual-gallery/full-engine.html?post=off&shadows=${shadows}&debug`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__phiPostTest?.ready,{timeout:120000});
  const atReady=await snapshot(page);
  await page.locator('#enter').press('Enter');
  // Same view and observation window in each cold browser. This includes the
  // first deferred uploads; shadow-free and shadowed scenes keep all detail.
  await page.waitForTimeout(12000);
  const afterEntry=await snapshot(page);
  const profile=await cdp.send('Profiler.stop');
  await writeFile(`phi-startup-audit/${index}-${name}.cpuprofile`,JSON.stringify(profile.profile));
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:r.name,bytes:r.transferSize,encoded:r.encodedBodySize,start:r.startTime,duration:r.duration})));
  const result={index,name,shadows,softwareRendering:true,viewport:'960x600 @1',atReady,afterEntry,errors,logs,resources};
  results.push(result);await writeFile('phi-startup-audit/results.json',JSON.stringify(results,null,2));
  console.log('AUDIT',JSON.stringify({index,name,ready:atReady.post.startupReadyMs,warm:atReady.post.warmMs,earlyFrames:afterEntry.post.summary,shadowStats:afterEntry.post.shadows,compiles:afterEntry.audit.compiles,programs:afterEntry.programs,deferredRuns:afterEntry.audit.deferredRuns,errors}));
 }finally{await browser.close();}
}
async function snapshot(page){return page.evaluate(()=>({post:window.__phiPostTest,audit:window.__phiAudit,longTasks:window.__auditLongTasks,render:window.__phiRenderStats,programs:window.__phiAudit?.renders.at(-1)?.programs,assets:{plants:window.__phiLiftState?.outdoorPlantsLoaded,props:window.__phiLiftState?.propsLoaded,paintings:window.__phiFullEngine?.paintingsLoaded},at:performance.now()}));}
