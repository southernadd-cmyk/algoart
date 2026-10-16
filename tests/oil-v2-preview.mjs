// Genuine ALGO/ART Oil V2 previews (never image-model generated).
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='oil-v2-preview-results';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}});
 page.setDefaultTimeout(180000);
 await page.goto(root+'?v=9&seed=OIL-V2-TEST-01&mode=organic&material=oil-v1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV1==='function');
 await page.addScriptTag({url:new URL('js/oil-paint-v2.js',root).href});
 const cases=[
  {mode:'organic',orientation:'landscape',seed:'OIL-V2-BRISTLES-01'},
  {mode:'rects',orientation:'portrait',seed:'OIL-V2-BRISTLES-02'},
  {mode:'network',orientation:'landscape',seed:'OIL-V2-BRISTLES-03'},
  {mode:'burst',orientation:'portrait',seed:'OIL-V2-BRISTLES-04'}
 ];
 const records=[];
 for(let i=0;i<cases.length;i++){
  const entry=await page.evaluate(({spec})=>{
   const A=window.AlgoArt,s={...A.readSettings(),...spec};
   const render=fn=>{
    const canvas=document.createElement('canvas'),start=performance.now();
    const stats=fn(canvas,s,.75,false),elapsed=performance.now()-start;
    return {elapsed,canvas,stats};
   };
   const baseline=render(A.renderOilPaintV1),v2=render(A.renderOilPaintV2);
   if(baseline.canvas.width!==v2.canvas.width||baseline.canvas.height!==v2.canvas.height)throw Error('Dimensions changed');
   const filaments=v2.stats.work.oilV2.visibleFineFilaments;
   if(filaments<30)throw Error('No visible V2 bristle filaments: '+filaments);
   return {baselineMs:baseline.elapsed,v2Ms:v2.elapsed,filaments,
      v1:baseline.canvas.toDataURL('image/png'),v2:v2.canvas.toDataURL('image/png'),
      size:[v2.canvas.width,v2.canvas.height]};
  },{spec:cases[i]});
  const name=String(i+1).padStart(2,'0')+'-'+cases[i].mode+'-'+cases[i].orientation;
  const fromDataUrl=s=>Buffer.from(s.split(',')[1],'base64');
  await writeFile(out+'/'+name+'-oil-v1.png',fromDataUrl(entry.v1));
  await writeFile(out+'/'+name+'-oil-v2.png',fromDataUrl(entry.v2));
  records.push({name,baselineMs:+entry.baselineMs.toFixed(1),v2Ms:+entry.v2Ms.toFixed(1),
    overheadPct:+((entry.v2Ms-entry.baselineMs)/entry.baselineMs*100).toFixed(1),
    filaments:entry.filaments,size:entry.size});
  console.log('CAPTURED genuine ALGO/ART oil v1/v2',JSON.stringify(records.at(-1)));
 }
 await writeFile(out+'/timings.json',JSON.stringify(records,null,2));
}finally{await browser.close()}
