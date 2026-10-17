import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const name=process.env.BROWSER_PROFILE||'default';
const profiles={
  default:[],
  swiftshader:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
};
assert(name in profiles,'Unknown browser profile');
const browser=await chromium.launch({headless:true,args:profiles[name]});
const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'];
const median=xs=>{const a=[...xs].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]};
const ratios=[];
let faster=0;
try{
  const page=await browser.newPage();
  await page.goto(root,{waitUntil:'load'});
  for(const mode of modes)for(const orientation of ['landscape','portrait']){
    const result=await page.evaluate(({mode,orientation})=>{
      const A=window.AlgoArt;
      const settings={...A.readSettings(),seed:'MATERIAL-BENCH-'+mode+'-'+orientation,
        mode,orientation,palette:'golden',colourCount:7,elements:45,density:63,complexity:59,negativeSpace:47};
      A.phiFramingEnabled=false;
      if(A.watercolourV2sOptions)A.watercolourV2sOptions.fitToSheet=false;
      const fnv=px=>{let h=2166136261;for(let i=0;i<px.length;i++)h=Math.imul(h^px[i],16777619);return h>>>0};
      const base=c=>A.renderViaCPUCanvas(inner=>A.renderWatercolourV2S(inner,settings,1,false),c,'watercolour-v2t-baseline');
      const fast=c=>A.renderWatercolourV2T(c,settings,1,false);
      function run(which){
        const canvas=document.createElement('canvas');
        const start=performance.now();
        (which==='baseline'?base:fast)(canvas);
        const ms=performance.now()-start;
        const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        return {ms,hash:fnv(rgba),width:canvas.width,height:canvas.height};
      }
      // Alternate order to reduce cache, JIT and thermal bias.
      const times={baseline:[],fast:[]},hashes={baseline:new Set(),fast:new Set()};
      for(let repetition=0;repetition<6;repetition++){
        const order=repetition%2===0?['baseline','fast']:['fast','baseline'];
        for(const which of order){
          const item=run(which);
          times[which].push(item.ms);
          hashes[which].add(item.hash);
          if(item.width!==(orientation==='landscape'?1400:1000)||item.height!==(orientation==='landscape'?1000:1400))
            throw Error('Bad dimensions '+mode+' '+orientation);
        }
      }
      const median=x=>{const a=[...x].sort((a,b)=>a-b);return(a[2]+a[3])/2};
      return {mode,orientation,baselineMs:median(times.baseline),
        fastMs:median(times.fast),hashes:[...hashes.baseline,...hashes.fast],
        parity:hashes.baseline.size===1&&hashes.fast.size===1&&
          [...hashes.baseline][0]===[...hashes.fast][0]};
    },{mode,orientation});
    console.log('V2T_AB_ROW '+JSON.stringify(result));
    assert(result.parity,'Pixel/hash mismatch '+mode+'/'+orientation);
    const ratio=result.baselineMs/result.fastMs;
    ratios.push(ratio);
    if(ratio>1)faster++;
  }
  const sorted=[...ratios].sort((a,b)=>a-b);
  const medianRatio=(sorted[7]+sorted[8])/2;
  const summary={profile:name,cases:ratios.length,faster,medianSpeedup:+medianRatio.toFixed(4),
    meanSpeedup:+(ratios.reduce((a,b)=>a+b,0)/ratios.length).toFixed(4),pixelExact:16};
  console.log('V2T_AB_SUMMARY '+JSON.stringify(summary));
  // No mandatory speed threshold: report the result, and decide only after review.
}finally{await browser.close()}
