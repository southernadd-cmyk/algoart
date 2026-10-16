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

 const cases=[
  {mode:'organic',orientation:'landscape',seed:'OIL-V2-MULTICOLOUR-01',palette:'golden',colourCount:8,saturation:86,brightness:55},
  {mode:'rects',orientation:'portrait',seed:'OIL-V2-MULTICOLOUR-02',palette:'golden',colourCount:8,saturation:86,brightness:55},
  {mode:'network',orientation:'landscape',seed:'OIL-V2-MULTICOLOUR-03',palette:'golden',colourCount:8,saturation:86,brightness:55},
  {mode:'burst',orientation:'portrait',seed:'OIL-V2-MULTICOLOUR-04',palette:'golden',colourCount:8,saturation:86,brightness:55}
 ];
 const records=[];
 for(let i=0;i<cases.length;i++){
  await page.goto(root+'?v=9&seed=OIL-V2-TEST-01&mode=organic&material=oil-v1',{waitUntil:'domcontentloaded'});
  const before=await page.evaluate(({spec})=>{
   const A=window.AlgoArt,s={...A.readSettings(),...spec};
   const render=fn=>{
    const canvas=document.createElement('canvas'),start=performance.now();
    const stats=fn(canvas,s,.75,false),elapsed=performance.now()-start;
    return {elapsed,canvas,stats};
   };
   const baseline=render(A.renderOilPaintV1);
   return {baselineMs:baseline.elapsed,v1:baseline.canvas.toDataURL('image/png'),
      size:[baseline.canvas.width,baseline.canvas.height]};
  },{spec:cases[i]});
  await page.addScriptTag({url:new URL('js/oil-v2-core-a.js',root).href});
  await page.addScriptTag({url:new URL('js/oil-paint-v2.js',root).href});
  const after=await page.evaluate(({spec})=>{
   const A=window.AlgoArt,s={...A.readSettings(),...spec},canvas=document.createElement('canvas');
   const start=performance.now(),stats=A.renderOilPaintV2(canvas,s,.75,false);
   return {v2Ms:performance.now()-start,
      filaments:stats.work.oilV2.visibleFineFilaments||0,
      v2:canvas.toDataURL('image/png'),size:[canvas.width,canvas.height]};
  },{spec:cases[i]});
  const entry={...before,...after};
  if(before.size.join(',')!==after.size.join(','))throw Error('Dimensions changed');

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
