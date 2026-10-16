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
  const before=await page.evaluate(({spec,firstCase})=>{
   const A=window.AlgoArt;
   const brushLab=()=>{
     const canvas=document.createElement('canvas');
     canvas.width=820;canvas.height=320;
     const ctx=canvas.getContext('2d');
     ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,820,320);
     const maskCanvas=document.createElement('canvas');
     maskCanvas.width=820;maskCanvas.height=320;
     const mask=maskCanvas.getContext('2d');
     const brush=A.oilPaintV4ETest.drawContactBrush;
     brush(ctx,mask,[{x:75,y:92},{x:300,y:81},{x:610,y:120}],56,
       [205,74,56],'flat',A.makeR('OIL-V2-LAB-CORAL'),
       {thickness:.88,drag:.54,bristles:.96});
     brush(ctx,mask,[{x:84,y:251},{x:330,y:230},{x:614,y:262}],49,
       [76,153,92],'filbert',A.makeR('OIL-V2-LAB-GREEN'),
       {thickness:.75,drag:.72,bristles:.90});
     return canvas.toDataURL('image/png');
   };
   const s={...A.readSettings(),...spec};
   const render=fn=>{
    const canvas=document.createElement('canvas'),start=performance.now();
    const stats=fn(canvas,s,.75,false),elapsed=performance.now()-start;
    return {elapsed,canvas,stats};
   };
   const baseline=render(A.renderOilPaintV1);
   const baselinePhases={...A.lastOilPaintV4EStats.phases};
   const baselineSamples=[baseline.elapsed];
   for(let repeat=0;repeat<2;repeat++)baselineSamples.push(render(A.renderOilPaintV1).elapsed);
   return {baselineMs:baseline.elapsed,baselineSamples,baselinePhases,v1:baseline.canvas.toDataURL('image/png'),
      size:[baseline.canvas.width,baseline.canvas.height],
      brushLab:firstCase?brushLab():null};
  },{spec:cases[i],firstCase:i===0});
  await page.evaluate(()=>{
    const A=window.AlgoArt;
    window.__oilV2SavedPlanner={
      planCompositionV5:A.planCompositionV5,
      captureCompositionV5:A.captureCompositionV5,
      planCompositionV5FromSource:A.planCompositionV5FromSource
    };
  });
  await page.addScriptTag({url:new URL('js/oil-v2-core-a.js',root).href});
  await page.evaluate(()=>{
    Object.assign(window.AlgoArt,window.__oilV2SavedPlanner);
    delete window.__oilV2SavedPlanner;
  });
  await page.addScriptTag({url:new URL('js/oil-paint-v2.js',root).href});
  const after=await page.evaluate(({spec,firstCase})=>{
   const A=window.AlgoArt;
   const brushLab=()=>{
     const canvas=document.createElement('canvas');
     canvas.width=820;canvas.height=320;
     const ctx=canvas.getContext('2d');
     ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,820,320);
     const maskCanvas=document.createElement('canvas');
     maskCanvas.width=820;maskCanvas.height=320;
     const mask=maskCanvas.getContext('2d');
     const brush=A.oilPaintV4ETest.drawContactBrush;
     brush(ctx,mask,[{x:75,y:92},{x:300,y:81},{x:610,y:120}],56,
       [205,74,56],'flat',A.makeR('OIL-V2-LAB-CORAL'),
       {thickness:.88,drag:.54,bristles:.96});
     brush(ctx,mask,[{x:84,y:251},{x:330,y:230},{x:614,y:262}],49,
       [76,153,92],'filbert',A.makeR('OIL-V2-LAB-GREEN'),
       {thickness:.75,drag:.72,bristles:.90});
     return canvas.toDataURL('image/png');
   };
   const s={...A.readSettings(),...spec},canvas=document.createElement('canvas');
   const start=performance.now(),stats=A.renderOilPaintV2(canvas,s,.75,false);
   const v2Ms=performance.now()-start,v2Samples=[v2Ms];
   const v2Phases={...A.lastOilPaintV4EStats.phases};
   for(let repeat=0;repeat<2;repeat++){
     const sample=document.createElement('canvas'),t=performance.now();
     A.renderOilPaintV2(sample,s,.75,false);
     v2Samples.push(performance.now()-t);
   }
   return {v2Ms,v2Samples,v2Phases,
      filaments:stats.work.oilV2.visibleFineFilaments||0,
      v2:canvas.toDataURL('image/png'),size:[canvas.width,canvas.height],
      brushLab:firstCase?brushLab():null,
      detailedTips:stats.work.oilV2.detailedTips,
      brushContacts:stats.work.oilV2.brushContacts};
  },{spec:cases[i],firstCase:i===0});
  const entry={...before,...after};
  if(before.size.join(',')!==after.size.join(','))throw Error('Dimensions changed');

  const name=String(i+1).padStart(2,'0')+'-'+cases[i].mode+'-'+cases[i].orientation;
  const fromDataUrl=s=>Buffer.from(s.split(',')[1],'base64');
  await writeFile(out+'/'+name+'-oil-v1.png',fromDataUrl(entry.v1));
  await writeFile(out+'/'+name+'-oil-v2.png',fromDataUrl(entry.v2));
  if(i===0){
    await writeFile(out+'/brush-tip-v1-lab.png',fromDataUrl(before.brushLab));
    await writeFile(out+'/brush-tip-v2-v4-lab.png',fromDataUrl(after.brushLab));
  }
  if(entry.v1===entry.v2)throw Error('V2 pixels unchanged for '+name);
  if(entry.filaments<20||entry.detailedTips<1)throw Error('V2 V4 bristles missing for '+name);
  const median=values=>[...values].sort((a,b)=>a-b)[1];
  const v1Median=median(entry.baselineSamples),v2Median=median(entry.v2Samples);
  records.push({name,baselineMs:+entry.baselineMs.toFixed(1),v2Ms:+entry.v2Ms.toFixed(1),
    overheadPct:+((entry.v2Ms-entry.baselineMs)/entry.baselineMs*100).toFixed(1),
    v1SamplesMs:entry.baselineSamples.map(v=>+v.toFixed(1)),
    v2SamplesMs:entry.v2Samples.map(v=>+v.toFixed(1)),
    v1MedianMs:+v1Median.toFixed(1),v2MedianMs:+v2Median.toFixed(1),
    medianOverheadPct:+((v2Median-v1Median)/v1Median*100).toFixed(1),
    v1Phases:entry.baselinePhases,v2Phases:entry.v2Phases,
    filaments:entry.filaments,detailedTips:entry.detailedTips,
    brushContacts:entry.brushContacts,size:entry.size});
  console.log('CAPTURED genuine ALGO/ART oil v1/v2',JSON.stringify(records.at(-1)));
 }
 await writeFile(out+'/timings.json',JSON.stringify(records,null,2));
}finally{await browser.close()}
