import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4173/?v=9&seed=DIFFUSION-EXACT&mode=organic&material=watercolour-v2s',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderWatercolourV2S==='function');
 const rows=await page.evaluate(()=>{
  const A=window.AlgoArt,base=A.readSettings(),rows=[];
  const options=[
    {name:'unchanged',scratch:false,skip:false,diffusion:false},
    {name:'paper-prep',scratch:true,skip:true,diffusion:false},
    {name:'paper-and-diffusion',scratch:true,skip:true,diffusion:true}
  ];
  const median=a=>{const s=[...a].sort((a,b)=>a-b);return (s[1]+s[2])/2};
  const render=(settings,scale,variant)=>{
    A.watercolourScratchPaperExperimental=variant.scratch;
    A.watercolourSkipZeroDensityLogExperimental=variant.skip;
    A.watercolourBlankDiffusionExperimental=variant.diffusion;
    const canvas=document.createElement('canvas'),start=performance.now();
    A.renderWatercolourV2S(canvas,settings,scale,false);
    return {ms:performance.now()-start,
      pixels:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,
      skipped:A.lastWatercolourSkippedEmptyDiffusion||0};
  };
  try{
   for(const mode of ['organic','rects','network','burst','spiral','field','geometric','scribble']){
    for(const orientation of ['landscape','portrait'])for(const scale of [.42,1]){
     const settings={...base,mode,seed:'DIFFUSION-'+mode+'-'+orientation+'-'+scale,orientation};
     const times=Object.fromEntries(options.map(o=>[o.name,[]]));
     let matches=true,skipped=0;
     for(const o of options)render(settings,scale,o);
     for(let repeat=0;repeat<4;repeat++){
      const control=render(settings,scale,options[0]);
      times.unchanged.push(control.ms);
      for(const variant of repeat%2?[options[2],options[1]]:[options[1],options[2]]){
       const sample=render(settings,scale,variant);
       times[variant.name].push(sample.ms);
       if(variant.diffusion)skipped=sample.skipped;
       if(sample.pixels.length!==control.pixels.length)matches=false;
       else for(let k=0;k<sample.pixels.length;k++)
        if(sample.pixels[k]!==control.pixels[k]){matches=false;break;}
      }
     }
     rows.push({mode,scale,exact:matches,skipped,
       baselineMs:median(times.unchanged),
       paperPrepMs:median(times['paper-prep']),
       paperAndDiffusionMs:median(times['paper-and-diffusion'])});
    }
   }
  }finally{
   delete A.watercolourScratchPaperExperimental;
   delete A.watercolourSkipZeroDensityLogExperimental;
   delete A.watercolourBlankDiffusionExperimental;
  }return rows;
 });
 for(const row of rows){console.log('WATERCOLOUR_DIFFUSION_CASE '+JSON.stringify(row));assert.equal(row.exact,true,'pixel mismatch '+row.mode+' '+row.scale);}
 const total=rows.reduce((a,x)=>({baseline:a.baseline+x.baselineMs,paper:a.paper+x.paperPrepMs,
  both:a.both+x.paperAndDiffusionMs,skipped:a.skipped+x.skipped}),{baseline:0,paper:0,both:0,skipped:0});
 const pct=(base,newer)=>+((base-newer)/base*100).toFixed(2);
 console.log('WATERCOLOUR_DIFFUSION_SUMMARY '+JSON.stringify({
  cases:rows.length,exactRGBA:rows.every(x=>x.exact),
  baselineMs:+total.baseline.toFixed(1),prepGainPct:pct(total.baseline,total.paper),
  combinedGainPct:pct(total.baseline,total.both),
  diffusionIncrementPct:pct(total.paper,total.both),
  fasterThanOriginal:rows.filter(x=>x.paperAndDiffusionMs<x.baselineMs).length,
  fasterThanPrep:rows.filter(x=>x.paperAndDiffusionMs<x.paperPrepMs).length,
  skippedEmptyCells:total.skipped}));
}finally{await browser.close()}
