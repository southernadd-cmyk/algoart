import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:850}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.goto('http://127.0.0.1:4173/?v=9&seed=RANDOM-OIL-START&mode=organic&material=oil-v3',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.AlgoArt?.renderOilPaintV3&&document.querySelector('#art')?.width>0);
 for(let i=0;i<16;i++){
   await page.locator('#randomise').click();
   const result=await page.evaluate(()=>{
    const canvas=document.getElementById('art'),settings=window.AlgoArt.readSettings();
    const c=document.createElement('canvas');c.width=24;c.height=24;
    const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(canvas,0,0,24,24);
    const pixels=cx.getImageData(0,0,24,24).data;
    let ink=0;for(let i=0;i<pixels.length;i+=4)
       if(pixels[i]+pixels[i+1]+pixels[i+2]<690)ink++;
    return {seed:settings.seed,mode:settings.mode,material:new URL(location.href).searchParams.get('material'),ink};
   });
   console.log('oil randomise',i,JSON.stringify(result), 'errors',errors.length);
   assert.equal(result.material,'oil-v3');
   assert(result.ink>2,'Blank oil artwork on randomise '+i+' '+JSON.stringify(result));
   assert.deepEqual(errors,[],'Oil Randomise browser exception');
 }
}finally{await browser.close()}
