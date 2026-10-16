import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4173/?v=9&seed=PAPER-CACHE-TEST&mode=organic&material=watercolour-v2s',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderWatercolourV2S==='function');
 const records=await page.evaluate(()=>{
  const A=window.AlgoArt,base=A.readSettings(),out=[];
  for(const mode of ['organic','rects','network','burst']){
   const settings={...base,mode,seed:'CACHE-'+mode,orientation:mode==='rects'?'portrait':'landscape'};
   for(const scale of [.42,1]){
    const render=(enabled)=>{A.watercolourPaperCellsExperimental=enabled;
      const canvas=document.createElement('canvas'),start=performance.now();
      A.renderWatercolourV2S(canvas,settings,scale,false);
      return {ms:performance.now()-start,pixels:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data};
    };
    render(false);render(true);
    const control=[],candidate=[];let mismatches=0;
    for(let i=0;i<4;i++){
     const first=render(i%2!==0),second=render(i%2===0);
     const a=i%2===0?first:second,b=i%2===0?second:first;
     control.push(a.ms);candidate.push(b.ms);
     for(let k=0;k<a.pixels.length;k++)if(a.pixels[k]!==b.pixels[k])mismatches++;
    }
    const median=a=>{const s=[...a].sort((x,y)=>x-y);return (s[1]+s[2])/2};
    out.push({mode,scale,mismatches,baseMs:median(control),cachedMs:median(candidate)});
   }
  }
  delete A.watercolourPaperCellsExperimental;return out;
 });
 for(const x of records){console.log('PAPER_CELLS_BENCH '+JSON.stringify(x));assert.equal(x.mismatches,0);}
}finally{await browser.close()}
