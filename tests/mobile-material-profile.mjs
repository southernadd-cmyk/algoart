// Profiling only: never changes renderer code or production defaults.
// Browser emulation measures UI-sized workloads, NOT real Android CPU/GPU speeds.
import {chromium,devices} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const mobile=process.env.PROFILE_DEVICE!=='desktop';
const repetitions=Math.max(2,Number(process.env.PROFILE_REPETITIONS||3));
const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'];
const materials=['marker','tissue-v7','watercolour-v2s','oil-v4'];
const median=a=>{const xs=[...a].sort((x,y)=>x-y),n=xs.length;return +(n%2?xs[n>>1]:(xs[n/2-1]+xs[n/2])/2).toFixed(2)};
const browser=await chromium.launch({headless:true,args:process.env.PROFILE_SWIFTSHADER==='1'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
const context=await browser.newContext(mobile?{...devices['Pixel 7'],reducedMotion:'reduce'}:{viewport:{width:1440,height:900}});
const page=await context.newPage();
const results=[];
try{
  await page.goto(root,{waitUntil:'load'});
  for(const material of materials){
    const run=await page.evaluate(({material,modes,repetitions})=>{
      const A=window.AlgoArt;
      const render={
        marker:(c,s,z)=>A.render(c,s,z,false),
        'tissue-v7':(c,s,z)=>A.renderOil(c,s,z,false,7),
        'watercolour-v2s':(c,s,z)=>A.renderWatercolourV2S(c,s,z,false),
        'oil-v4':(c,s,z)=>A.renderOilPaintV4(c,s,z,false)
      }[material];
      const makeSettings=mode=>({...A.readSettings(),seed:'MOBILE-PROFILE-'+mode,
        mode,orientation:'portrait',palette:'golden',colourCount:7,elements:45,
        density:63,complexity:59,negativeSpace:47});
      const hash=bytes=>{let h=2166136261;for(let i=0;i<bytes.length;i++)h=Math.imul(h^bytes[i],16777619);return h>>>0};
      const profile=(mode,scale)=>{
        const c=document.createElement('canvas');
        const t=performance.now();render(c,makeSettings(mode),scale);
        const renderMs=performance.now()-t;
        const scan=performance.now();
        const rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
        const readbackMs=performance.now()-scan;
        return {renderMs,readbackMs,hash:hash(rgba),pixels:c.width*c.height};
      };
      A.phiFramingEnabled=false;
      if(A.watercolourV2sOptions)A.watercolourV2sOptions.fitToSheet=false;
      const samples=[];
      // Repeat identical work; hashes must remain stable within each material/mode/scale.
      for(let rep=0;rep<repetitions;rep++){
        const full=profile('field',1);
        const drag=profile('field',.35);
        const thumbs=modes.map(mode=>profile(mode,.1));
        const variations=Array.from({length:4},(_,i)=>profile(modes[i],.28));
        samples.push({full,drag,thumbs,variations});
      }
      const exact=(getter)=>{
        const hashes=samples.map(getter);
        assertSame(hashes);
        return hashes[0];
      };
      function assertSame(hashes){
        if(!hashes.every(x=>x===hashes[0]))throw Error('Nondeterministic '+material+' hash sequence');
      }
      exact(s=>s.full.hash);exact(s=>s.drag.hash);
      for(let i=0;i<8;i++)exact(s=>s.thumbs[i].hash);
      for(let i=0;i<4;i++)exact(s=>s.variations[i].hash);
      return {
        material,
        fullMs:samples.map(s=>s.full.renderMs),
        dragMs:samples.map(s=>s.drag.renderMs),
        thumbsMs:samples.map(s=>s.thumbs.reduce((x,y)=>x+y.renderMs,0)),
        variationsMs:samples.map(s=>s.variations.reduce((x,y)=>x+y.renderMs,0)),
        fullReadbackMs:samples.map(s=>s.full.readbackMs),
        fullHash:samples[0].full.hash,
        fullPixels:samples[0].full.pixels
      };
    },{material,modes,repetitions});
    const summary={device:mobile?'emulated-Pixel-7':'desktop-Chromium',material,
      fullMs:median(run.fullMs),dragMs:median(run.dragMs),
      eightThumbsMs:median(run.thumbsMs),fourVariationsMs:median(run.variationsMs),
      fullReadbackMs:median(run.fullReadbackMs),fullPixels:run.fullPixels,fullHash:run.fullHash,
      repetitions};
    console.log('MOBILE_MATERIAL_PROFILE '+JSON.stringify(summary));
    results.push(summary);
  }
  await mkdir('mobile-profile-results',{recursive:true});
  await writeFile('mobile-profile-results/report.json',JSON.stringify({results,description:'Emulated viewport/touch only, not physical mobile device timings'},null,2));
}finally{await browser.close()}
