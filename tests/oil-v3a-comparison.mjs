// Experimental V3a comparison: use exactly the same source settings as V2.
// Run with ALGOART_LOCAL_URL=http://127.0.0.1:4173/ node tests/oil-v3a-comparison.mjs
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
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
      width:c.width,height:c.height,version:result.version};
   }
   run('v2');run('v3');
   return {v2:run('v2'),v3:run('v3')};
  },spec);
  const key=spec.mode+'-'+spec.orientation;
  for(const version of ['v2','v3']){
   const v=result[version],data=v.png;
   await writeFile(output+'/'+key+'-'+version+'.png',
    Buffer.from(data.slice(data.indexOf(',')+1),'base64'));
   delete v.png;
  }
  report.push({case:key,spec,...result});
  console.log(JSON.stringify(report[report.length-1]));
 }
 await writeFile(output+'/report.json',JSON.stringify({cases:report,errors},null,2));
 assert.deepEqual(errors,[]);
 assert(report.every(x=>x.v2.width===x.v3.width&&x.v2.height===x.v3.height));
}finally{await browser.close();}
