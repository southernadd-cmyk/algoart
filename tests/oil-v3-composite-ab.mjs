import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage(); page.setDefaultTimeout(180000);
 await page.goto('http://127.0.0.1:4173/?v=9&seed=COMP-AB&mode=organic&material=oil-v3',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV3==='function');
 const rows=await page.evaluate(()=>{
  const A=window.AlgoArt,base=A.readSettings(),results=[];
  function render(s,experimental){
   A.oilV3CompositeStateExperimental=experimental;
   A.oilV3CompositeProfile={pigmentMs:0,reliefMs:0,pigmentCalls:0,reliefCalls:0};
   const canvas=document.createElement('canvas');
   const start=performance.now(); A.renderOilPaintV3(canvas,s,1,false);
   const ms=performance.now()-start,profile=A.oilV3CompositeProfile;
   const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   A.oilV3CompositeStateExperimental=false;A.oilV3CompositeProfile=null;
   return {ms,profile,pixels};
  }
  for(const [mode,orientation] of [['organic','landscape'],['rects','portrait'],['network','landscape'],['burst','portrait']]){
   const s={...base,seed:'MATERIAL-BENCH-'+mode+'-'+orientation,mode,orientation,palette:'golden',
    colourCount:7,elements:45,density:63,complexity:59,negativeSpace:47};
   render(s,false);render(s,true);
   const control=render(s,false),trial=render(s,true);
   let exact=control.pixels.length===trial.pixels.length;
   if(exact)for(let i=0;i<control.pixels.length;i++)if(control.pixels[i]!==trial.pixels[i]){exact=false;break}
   results.push({mode,exact,baselineMs:+control.ms.toFixed(1),candidateMs:+trial.ms.toFixed(1),
     pigmentMs:+trial.profile.pigmentMs.toFixed(1),reliefMs:+trial.profile.reliefMs.toFixed(1),
     pigmentCalls:trial.profile.pigmentCalls,reliefCalls:trial.profile.reliefCalls});
  }return results;
 });
 for(const r of rows){console.log('OIL_COMPOSITE_AB '+JSON.stringify(r));assert(r.exact,'Pixel mismatch '+r.mode)}
}finally{await browser.close()}
