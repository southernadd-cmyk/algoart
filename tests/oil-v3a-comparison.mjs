// Experimental V3a comparison: use exactly the same source settings as V2.
// Run with ALGOART_LOCAL_URL=http://127.0.0.1:4173/ node tests/oil-v3a-comparison.mjs
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const output='oil-v3a-results';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1450,height:960}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?v=9&seed=OIL-V3A-INIT&mode=organic&material=oil-v2',
  {waitUntil:'domcontentloaded',timeout:120000});
 await page.evaluate(async()=>{
  for(const name of ['oil-brush-v3','oil-paint-v3']){
   const s=document.createElement('script');s.src='js/'+name+'.js';
   await new Promise((resolve,reject)=>{s.onload=resolve;s.onerror=reject;document.head.append(s)});
  }
 });
 const cases=[
  {mode:'organic',orientation:'landscape',seed:'OIL-V3A-ORG-01',profile:'dry'},
  {mode:'rects',orientation:'portrait',seed:'OIL-V3A-RECT-02',profile:'flat'},
  {mode:'network',orientation:'landscape',seed:'OIL-V3A-NET-03',profile:'dry'},
  {mode:'burst',orientation:'portrait',seed:'OIL-V3A-BURST-04',profile:'filbert'}
 ];
 // Directly exercise dry contact, independently of V5 profile selection.
 const dryProbe=await page.evaluate(()=>{
   const A=window.AlgoArt,oldStats=A.oilStageCStats;
   const c=document.createElement('canvas'),h=document.createElement('canvas');
   c.width=h.width=500;c.height=h.height=250;
   const p=c.getContext('2d'),m=h.getContext('2d');
   const points=Array.from({length:65},(_,i)=>({x:20+i*6,y:110+12*Math.sin(i*.1)}));
   const random=(()=>{let v=123456789;return{
     range:(a,b)=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return a+(b-a)*(v/4294967296);},
     chance(t){return this.range(0,1)<t;}
   };})();
   A.oilStageCStats={};A.oilStageCScale=1;A.oilStageDRefinement=true;
   try{
     A.oilPaintV4ETest.drawContactBrushV3(p,m,points,34,[200,80,50],'dry',random,{thickness:.9,drag:.8});
     return {...A.oilStageCStats,nonEmpty:p.getImageData(0,0,500,250).data.some((v,i)=>i%4===3&&v>0)};
   }finally{A.oilStageCStats=oldStats;}
 });
 assert(dryProbe.dryRuns>0&&dryProbe.toothDeposits>0&&dryProbe.nonEmpty,
   'Dry brush tooth renderer was not actually exercised');
 await writeFile(output+'/dry-probe.json',JSON.stringify(dryProbe,null,2));
 const report=[];
 for(const spec of cases){
  const result=await page.evaluate(spec=>{
   const A=window.AlgoArt;
   const settings={...A.readSettings(),...spec,
    palette:'golden',colourCount:8,saturation:86,brightness:55,
    density:67,elements:48,complexity:65,negativeSpace:52};
   function run(version){
    const c=document.createElement('canvas');
    const started=performance.now();
    const result=(version==='v2'?A.renderOilPaintV2:A.renderOilPaintV3)(c,settings,.45,false);
    return {ms:performance.now()-started,png:c.toDataURL('image/png'),
      width:c.width,height:c.height,version:result.version,v3BrushCalls:result.v3BrushCalls||0,v3BrushMetrics:result.v3BrushMetrics||null};
   }
   run('v2');run('v3');
   return {v2:run('v2'),v3:run('v3')};
  },spec);
  const key=spec.mode+'-'+spec.orientation;
  const equal=result.v2.png===result.v3.png;
  const sha=data=>createHash('sha256').update(data).digest('hex');
  const hashes={v2:sha(result.v2.png),v3:sha(result.v3.png)};
  for(const version of ['v2','v3']){
   const v=result[version],data=v.png;
   await writeFile(output+'/'+key+'-'+version+'.png',
    Buffer.from(data.slice(data.indexOf(',')+1),'base64'));
   delete v.png;
  }
  assert(result.v3.v3BrushCalls>0,'V3 physical brush was never invoked for '+key);
  assert(!equal,'V3 produced identical pixels to V2 for '+key);
  report.push({case:key,spec,hashes,...result,relativeTime: +(result.v3.ms/result.v2.ms).toFixed(3)});
  console.log(JSON.stringify(report[report.length-1]));
 }
 await writeFile(output+'/report.json',JSON.stringify({cases:report,errors},null,2));
 assert.deepEqual(errors,[]);
 assert(report.every(x=>x.v2.width===x.v3.width&&x.v2.height===x.v3.height));
}finally{await browser.close();}
