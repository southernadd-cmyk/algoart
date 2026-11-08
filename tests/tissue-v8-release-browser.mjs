import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1120,height:780}});
await context.addInitScript(()=>{
 localStorage.setItem('algoart-intro-seen','1');
 localStorage.setItem('algoart-ethos-seen','1');
});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const common='v=10&seed=TISSUE-V8-RELEASE-RECTS&mode=rects&el=18&den=52&phi=90';
async function open(material){
 await page.goto(root+'?'+common+'&'+material,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(document.getElementById('statsText')?.textContent?.trim())&&
   document.getElementById('creatingOverlay')?.hidden===true,{timeout:180000});
 return page.evaluate(()=>({
   pixels:document.getElementById('art').toDataURL('image/png'),
   stats:window.AlgoArt.lastOilMaterialStats,
   layered:window.AlgoArt.lastTissueV8Stats
 }));
}
try{
 const v7=await open('tissue=7');
 assert.equal(v7.stats.tissuePaletteVersion,7);
 assert.equal(v7.stats.graphitePaths,0);
 const v8=await open('material=tissue-v8');
 assert.equal(v8.layered?.variant,'layered-v8');
 assert.equal(v8.layered?.tissuePaletteVersion,8);
 assert(v8.layered?.graphitePaths>0);
 assert.notEqual(v7.pixels,v8.pixels);
 const png=await page.evaluate(async()=>{
  const A=window.AlgoArt,s={...A.readSettings(),oilRender:true,
   tissuePaletteVersion:7,tissueLayeredV8:true};
  const r=await A.preparePNG(s,1);
  return {bytes:r.blob.size,variant:A.lastTissueV8Stats?.variant};
 });
 assert(png.bytes>20000);
 assert.equal(png.variant,'layered-v8');
 assert.equal((await open('material=tissue-v8')).pixels,v8.pixels);
 assert.equal((await open('material=tissue-v8-layered')).pixels,v8.pixels);
 assert.equal((await open('tissue=7')).pixels,v7.pixels);
 await open('tissue=8');
 assert.deepEqual(errors,[]);
 console.log('PASS released Tissue V8 renderer, PNG and historical links');
}finally{await browser.close();}
