// Function-level CPU profiling without changing artwork or renderer code.
// Uses Chromium CDP sampling. CPU throttling is synthetic, not a real phone.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2.75});
const page=await context.newPage();
const cdp=await context.newCDPSession(page);
const materials=['marker','tissue-v7','watercolour-v2s','oil-v4'];
const workloads=['full','eight-thumbnails'];
const results=[];
try {
  await page.goto(url,{waitUntil:'load'});
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval',{interval:100});
  // Set PROFILE_CPU_THROTTLE=4 to approximate a constrained processor; default 1.
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:Math.max(1,Number(process.env.PROFILE_CPU_THROTTLE||1))});
  for(const material of materials)for(const workload of workloads){
    await cdp.send('Profiler.start');
    const output=await page.evaluate(({material,workload})=>{
      const A=window.AlgoArt;
      const render={
        marker:(c,s,z)=>A.render(c,s,z,false),
        'tissue-v7':(c,s,z)=>A.renderOil(c,s,z,false,7),
        'watercolour-v2s':(c,s,z)=>A.renderWatercolourV2S(c,s,z,false),
        'oil-v4':(c,s,z)=>A.renderOilPaintV4(c,s,z,false)
      }[material];
      const modes=workload==='full'?['field']:['field','spiral','rects','burst','network','organic','geometric','scribble'];
      const scale=workload==='full'?1:.1;
      A.phiFramingEnabled=false;
      if(A.watercolourV2sOptions)A.watercolourV2sOptions.fitToSheet=false;
      const hashes=[];
      const start=performance.now();
      for(const mode of modes){
        const canvas=document.createElement('canvas');
        const s={...A.readSettings(),mode,orientation:'portrait',
          seed:'PIXEL-EXACT-PROF-'+mode,palette:'golden',
          colourCount:7,elements:45,density:63,complexity:59,negativeSpace:47};
        render(canvas,s,scale);
        const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let h=2166136261;
        for(let i=0;i<rgba.length;i++)h=Math.imul(h^rgba[i],16777619);
        hashes.push(h>>>0);
      }
      return {ms:+(performance.now()-start).toFixed(1),hashes};
    },{material,workload});
    const {profile}=await cdp.send('Profiler.stop');
    const idMap=new Map(profile.nodes.map(n=>[n.id,n]));
    const counts=new Map();
    for(let i=0;i<profile.samples.length;i++){
      const node=idMap.get(profile.samples[i]);if(!node)continue;
      const f=node.callFrame;
      const key=[f.functionName||'(anonymous)',f.url.split('/').pop(),f.lineNumber+1].join(' @ ');
      counts.set(key,(counts.get(key)||0)+1);
    }
    const top=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([functionName,samples])=>({functionName,samples}));
    const result={material,workload,...output,totalSamples:profile.samples.length,top};
    console.log('MATERIAL_HOTSPOTS '+JSON.stringify(result));
    results.push(result);
  }
  await mkdir('material-hotspots-results',{recursive:true});
  await writeFile('material-hotspots-results/results.json',JSON.stringify(results,null,2));
}finally{await browser.close()}
