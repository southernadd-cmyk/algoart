// Separate-page CPU/GPU scratch experiment. No production defaults changed.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const cases=[['organic','landscape'],['rects','portrait'],['network','landscape'],['burst','portrait']];
const settingsCase=(mode,orientation)=>({mode,orientation,seed:'MATERIAL-BENCH-'+mode+'-'+orientation,
 palette:'golden',colourCount:7,elements:45,density:63,complexity:59,negativeSpace:47});
async function render(mode,orientation,cpu){
 const page=await browser.newPage({viewport:{width:1400,height:950}});
 page.setDefaultTimeout(180000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(cpu=>{window.AlgoArt={oilCPUScratchExperimental:cpu}},cpu);
 await page.goto(root+'?v=9&seed=OIL-CPU-BENCH&mode=organic&material=oil-v3',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV3==='function');
 const data=await page.evaluate(spec=>{
  const A=window.AlgoArt,settings={...A.readSettings(),...spec};
  const c=document.createElement('canvas'),start=performance.now();
  A.renderOilPaintV3(c,settings,1,false);
  return {ms:+(performance.now()-start).toFixed(1),png:c.toDataURL('image/png'),
   width:c.width,height:c.height};
 },settingsCase(mode,orientation));
 assert.deepEqual(errors,[]);await page.close();return data;
}
async function difference(reference,candidate){
 const page=await browser.newPage();
 const result=await page.evaluate(async([a,b])=>{
  async function pixels(src){
   const img=new Image();img.src=src;await img.decode();
   const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
   const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);
   return x.getImageData(0,0,c.width,c.height).data;
  }
  const x=await pixels(a),y=await pixels(b);
  let changed=0,sum=0,max=0;
  for(let i=0;i<x.length;i+=4){
   let differ=false;for(let ch=0;ch<4;ch++){
    const d=Math.abs(x[i+ch]-y[i+ch]);sum+=d;max=Math.max(max,d);if(d)differ=true;
   }if(differ)changed++;
  }
  return {changedPct:+(100*changed/(x.length/4)).toFixed(4),
    meanAbsoluteChannelDifference:+(sum/x.length).toFixed(5),maxChannelDifference:max};
 },[reference,candidate]);await page.close();return result;
}
try{
 for(const [mode,orientation] of cases){
  const gpu=await render(mode,orientation,false),cpu=await render(mode,orientation,true);
  const delta=await difference(gpu.png,cpu.png);
  console.log('OIL_CPU_SCRATCH '+JSON.stringify({mode,orientation,gpuMs:gpu.ms,cpuMs:cpu.ms,
    speedup:+(gpu.ms/cpu.ms).toFixed(2),dimensionsMatch:gpu.width===cpu.width&&gpu.height===cpu.height,...delta}));
  assert.equal(gpu.width,cpu.width);assert.equal(gpu.height,cpu.height);
 }
}finally{await browser.close()}
