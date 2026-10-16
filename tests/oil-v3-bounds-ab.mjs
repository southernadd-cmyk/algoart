// Pixel-exact A/B of frame-bounds fast-path. Production remains unchanged.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 page.setDefaultTimeout(180000);
 await page.goto('http://127.0.0.1:4173/?v=9&seed=OIL-BOUNDS-AB&mode=organic&material=oil-v3',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV3==='function');
 const results=await page.evaluate(()=>{
  const A=window.AlgoArt,base=A.readSettings(),rows=[];
  const modes=['organic','rects','network','burst'];
  function render(settings,scale,fast){
   A.oilV3BoundsFastExperimental=fast;
   const canvas=document.createElement('canvas'),start=performance.now();
   A.renderOilPaintV3(canvas,settings,scale,false);
   const elapsed=performance.now()-start;
   const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   return {elapsed,pixels};
  }
  try{
   for(let i=0;i<modes.length;i++){
    const mode=modes[i],scale=1,settings={...base,mode,
      orientation:i%2?'portrait':'landscape',seed:'MATERIAL-BENCH-'+mode+'-'+(i%2?'portrait':'landscape'),
      palette:'golden',colourCount:7,elements:45,density:63,complexity:59,negativeSpace:47};
    render(settings,scale,false);render(settings,scale,true);
    const baseline=[],candidate=[];let match=true;
    for(let n=0;n<3;n++){
     const order=n%2?[true,false]:[false,true],pair={};
     for(const fast of order)pair[fast?'fast':'slow']=render(settings,scale,fast);
     baseline.push(pair.slow.elapsed);candidate.push(pair.fast.elapsed);
     if(pair.slow.pixels.length!==pair.fast.pixels.length)match=false;
     else for(let k=0;k<pair.slow.pixels.length;k++)if(pair.slow.pixels[k]!==pair.fast.pixels[k]){match=false;break}
    }
    const median=a=>[...a].sort((a,b)=>a-b)[1];
    rows.push({mode,exact:match,baselineMs:+median(baseline).toFixed(2),
      experimentalMs:+median(candidate).toFixed(2),
      improvementPct:+((median(baseline)-median(candidate))/median(baseline)*100).toFixed(2)});
   }
  }finally{delete A.oilV3BoundsFastExperimental}
  return rows;
 });
 for(const row of results){console.log('OIL_BOUNDS_AB '+JSON.stringify(row));assert(row.exact,'Pixels changed for '+row.mode)}
}finally{await browser.close()}
