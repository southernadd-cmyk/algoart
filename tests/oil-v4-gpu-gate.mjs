// Focused release gate: new Oil V4 only, all 8 engines x 2 orientations.
// Does not rerender slow historical V3. Checks frozen CI reference hashes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const expected=JSON.parse(await readFile(new URL('./fixtures/cpu-context-reference.json',import.meta.url),'utf8')).references;
const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'];
const orientations=['landscape','portrait'];
const browser=await chromium.launch({headless:true,args:[
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const results=[];
try{
 const page=await browser.newPage();
 page.setDefaultTimeout(300000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/?v=9&seed=OIL-V4-VALIDATION&mode=organic&material=marker',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV4==='function');
 for(const orientation of orientations)for(const mode of modes){
  const key=['oil',mode,orientation,1].join('|');
  assert(expected[key],'Missing fixture '+key);
  const result=await page.evaluate(({mode,orientation})=>{
   const A=window.AlgoArt;
   A.phiFramingEnabled=false;
   const settings={...A.readSettings(),seed:'MATERIAL-BENCH-'+mode+'-'+orientation,mode,orientation,
    palette:'golden',colourCount:7,elements:45,density:63,complexity:59,negativeSpace:47};
   const c=document.createElement('canvas'),start=performance.now();
   A.renderOilPaintV4(c,settings,1,false);
   const ctx=c.getContext('2d');
   const rgba=ctx.getImageData(0,0,c.width,c.height).data;
   let hash=2166136261,translucent=0;
   for(let i=0;i<rgba.length;i++){hash=Math.imul(hash^rgba[i],16777619);if(i%4===3&&rgba[i]!==255)translucent++}
   return {hash:hash>>>0,width:c.width,height:c.height,ms:Math.round(performance.now()-start),
    translucent,audit:A.lastCPUCanvasRender,visibleReadFrequently:A.canvasReadFrequently(ctx)};
  },{mode,orientation});
  assert.equal(result.hash,expected[key].hash,'Pixel hash mismatch '+key);
  assert.equal(result.width,expected[key].width,'Width mismatch '+key);
  assert.equal(result.height,expected[key].height,'Height mismatch '+key);
  assert.equal(result.translucent,0,'Unexpected translucency '+key);
  assert.equal(result.audit?.nonCpu,0,'Non-CPU intermediates '+key);
  assert(result.audit?.contexts>0,'No CPU context audit '+key);
  assert.equal(result.visibleReadFrequently,false,'Visible canvas is CPU '+key);
  results.push({key,hash:result.hash,ms:result.ms});
  console.log('OIL_V4_GPU_PASS '+JSON.stringify(results.at(-1)));
 }
 assert.deepEqual(errors,[]);
 console.log('OIL_V4_GPU_COMPLETE '+JSON.stringify({cases:results.length,totalMs:results.reduce((n,x)=>n+x.ms,0)}));
}finally{await browser.close()}
