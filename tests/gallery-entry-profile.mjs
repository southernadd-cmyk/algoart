import {chromium} from 'playwright';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
const label=process.argv[2]||'baseline'; await mkdir('entry-profile',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const [name,path] of [['live','/gallery/visit/?debug'],['test','/test/virtual-gallery/full-engine.html?debug']]){
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 await page.route('https://cdn.jsdelivr.net/npm/three@0.180.0/**',async route=>{const p=route.request().url().split('three@0.180.0/')[1];await route.fulfill({path:'node_modules/three/'+p,contentType:'text/javascript'});});
 const errors=[],logs=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Gallery performance|Gallery startup/.test(m.text()))logs.push(m.text());});
 await page.addInitScript(()=>{
  window.__entryMetrics={tasks:[],frames:[],entryAt:0};let previous=0;
  new PerformanceObserver(list=>{for(const e of list.getEntries())window.__entryMetrics.tasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
  const frame=now=>{if(previous)window.__entryMetrics.frames.push({start:previous,ms:now-previous});previous=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
 });
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
 await page.goto('http://127.0.0.1:4173'+path,{waitUntil:'domcontentloaded'});
 try{
  await page.waitForFunction(()=>!document.querySelector('#enter').disabled,{timeout:90000});
  await page.evaluate(()=>window.__entryMetrics.entryAt=performance.now());await page.locator('#enter').click();
  await page.waitForTimeout(8000);
  const metrics=await page.evaluate(()=>({...window.__entryMetrics,stats:window.__phiPerformance,graffiti:window.__phiSquare,renderer:window.__phiRenderStats,graffiti:window.__phiGraffitiStats}));
  const {profile}=await cdp.send('Profiler.stop');await writeFile('entry-profile/'+label+'-'+name+'-cpu.json',JSON.stringify(profile));
  const summarise=items=>{const a=items.map(e=>e.ms).sort((a,b)=>a-b);return {frames:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1),over50:a.filter(v=>v>50).length};};
  const output={name,entryAt:metrics.entryAt,before:summarise(metrics.frames.filter(f=>f.start<metrics.entryAt)),after:summarise(metrics.frames.filter(f=>f.start>=metrics.entryAt)),tasks:metrics.tasks,stats:{...metrics.stats,samples:undefined},renderer:metrics.renderer,graffiti:metrics.graffiti,logs,errors};
  console.log(JSON.stringify(output));await writeFile('entry-profile/'+label+'-'+name+'.json',JSON.stringify(output,null,2));
 }catch(e){console.log(name,e.message,errors,logs);}
 await page.close();
}
await browser.close();
