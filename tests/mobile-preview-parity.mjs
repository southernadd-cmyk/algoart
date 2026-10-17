// The mobile scheduler may spread work across tasks, but must not change pixels.
// Compare the eight finished thumbnails in mobile and desktop Chromium.
import assert from 'node:assert/strict';
import {chromium,devices} from 'playwright';
const browser=await chromium.launch({headless:true});
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
async function run(mobile,material){
  const context=await browser.newContext(mobile?{...devices['Pixel 7']}:{viewport:{width:1440,height:900}});
  const page=await context.newPage();
  try{
    await page.goto(root+'?seed=MOBILE-SCHEDULER-TEST&material='+material,{waitUntil:'load'});
    await page.waitForFunction(()=>[...document.querySelectorAll('.mode-card canvas')].length===8&&
      [...document.querySelectorAll('.mode-card canvas')].every(c=>c.width>0&&c.height>0),{timeout:30000});
    // Wait for all card pixels to stabilise after async yielding (or a synchronous burst).
    let previous='',stable=0,hashes=[];
    const start=Date.now();
    while(Date.now()-start<45000){
      hashes=await page.evaluate(()=>{
        const fnv=px=>{let h=2166136261;for(let i=0;i<px.length;i++)h=Math.imul(h^px[i],16777619);return h>>>0};
        return [...document.querySelectorAll('.mode-card canvas')].map(c=>fnv(c.getContext('2d').getImageData(0,0,c.width,c.height).data));
      });
      const signature=hashes.join(',');
      if(signature===previous)stable++;else stable=0;
      if(stable>=5)break;
      previous=signature;
      await page.waitForTimeout(350);
    }
    assert(stable>=5,'Thumbnails did not stabilise');
    return hashes;
  }finally{await context.close()}
}
try{
  for(const material of ['oil-v4','watercolour-v2s']){
    const desktop=await run(false,material);
    const mobile=await run(true,material);
    assert.deepEqual(mobile,desktop,material+' mobile previews changed pixels');
    console.log('MOBILE_PREVIEW_PARITY '+JSON.stringify({material,count:mobile.length,exact:true}));
  }
}finally{await browser.close()}
