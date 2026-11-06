import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/',
 out='oil-v8-results';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1550,height:1080}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'],
 cases=[];
for(const [i,mode] of modes.entries())for(const orientation of ['landscape','portrait'])
 cases.push({seed:'OIL-V8-'+mode+'-'+orientation,mode,orientation,
  phi:i%3===0?0:i%3===1?50:100,density:53,elements:36,scale:.30});
cases.push({seed:'OIL-V8-SPARSE-RECTS',mode:'rects',orientation:'landscape',phi:100,density:12,elements:5,scale:.3});
cases.push({seed:'OIL-V8-SPARSE-ORGANIC',mode:'organic',orientation:'portrait',phi:0,density:14,elements:5,scale:.3});
cases.push({seed:'OIL-V8-FULL-RECTS',mode:'rects',orientation:'landscape',phi:91,density:53,elements:36,scale:1});
try{
 await page.goto(root+'test/oil-v8/?manual=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV8==='function');
 for(const [index,s] of cases.entries()){
  const r=await page.evaluate(async s=>{
   for(const key of ['seed','mode','orientation','phi','density','elements','scale'])
    document.getElementById(key).value=String(s[key]);
   const result=await window.oilV8Study.render();
   return {settings:s,checks:{sourceSame:result.structuralSame,voidsSame:result.voidsSame,
    v7ReplayStable:result.v7ReplayHash===result.panels.v7.pixel.hash},
    v7:result.panels.v7.pixel,
    stages:Object.fromEntries(['settle','displace','boundary'].map(k=>[k,{
     pixels:result.panels[k].pixel,flow:result.panels[k].flow,
     voidComparison:result.panels[k].voidComparison,timeMs:result.panels[k].timeMs}])),
    timeV7:result.panels.v7.timeMs};
  },s);
  assert(r.checks.v7ReplayStable,'V7 historical hash preserved '+s.seed);
  assert(r.checks.sourceSame&&r.checks.voidsSame,'Composition / negative-space parity '+s.seed);
  for(const [stage,v] of Object.entries(r.stages)){
   assert(v.voidComparison.differences===0,'Protected void unchanged '+s.seed+' '+stage);
   assert(Math.abs(v.flow.massErrorPct)<.2,'Paint volume conserved '+s.seed+' '+stage);
   assert(v.flow.constrainedToSourcePaint,'No new compositional positions '+stage);
   assert.equal(v.pixels.width,r.v7.width,'Source image width '+stage);
   assert.equal(v.pixels.height,r.v7.height,'Source image height '+stage);
  }
  results.push(r);
  const flows=Object.values(r.stages).map(x=>x.flow);
  console.log('PASS '+s.seed+' '+JSON.stringify({V7:r.timeV7.toFixed(1),
   flowMs:flows.map(f=>+f.elapsedMs.toFixed(1)),heightMoved:flows.map(f=>f.changedHeightPixels),
   pigmentMoved:flows.map(f=>f.colourShiftedPixels),ridges:flows[2].edgeRidges,
   protected:flows.map(f=>f.protectedPixels),volume:flows.map(f=>+f.massErrorPct.toFixed(4))}));
  if(['OIL-V8-rects-landscape','OIL-V8-organic-portrait','OIL-V8-geometric-landscape','OIL-V8-FULL-RECTS'].includes(s.seed)){
   await page.screenshot({path:out+'/'+s.seed+'-four-panels.png',fullPage:true});
   if(s.scale===1){
    const pngs=await page.evaluate(()=>Object.fromEntries(
     ['v7','settle','displace','boundary'].map(k=>[k,document.getElementById(k).toDataURL('image/png').split(',')[1]])));
    for(const [name,data] of Object.entries(pngs))
     await writeFile(out+'/native-'+name+'.png',Buffer.from(data,'base64'));
   }
  }
 }
 assert(results.some(r=>r.stages.boundary.flow.edgeRidges>0),'Boundary effect must actually execute');
 assert(results.some(r=>r.stages.displace.flow.colourShiftedPixels>0),'Wet pigment displacement must actually execute');
 assert(results.some(r=>r.stages.settle.flow.changedHeightPixels>0),'Viscous height relaxation must actually execute');
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile / portrait layout must not clip');
 assert.deepEqual(errors,[],'No browser errors');
 const report={count:results.length,allIntegrityPassed:true,
  note:'CI checks composition and protected pixels, not that experimental paint is aesthetically better. Times are single browser runs and must be retested.',
  results};
 await writeFile(out+'/results.json',JSON.stringify(report,null,2));
 console.log('PASS Oil V8 comparison '+results.length+' cases, all protected voids & V7 hashes stable.');
}finally{await browser.close();}
