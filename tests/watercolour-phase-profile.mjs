import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:960}});
 await page.goto(root+'?v=9&seed=WATER-PROFILE&mode=organic&material=watercolour-v2s',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderWatercolourV2S==='function');
 const modes=['organic','rects','network','burst'];
 const records=await page.evaluate(modes=>{
  const A=window.AlgoArt,base=A.readSettings(),results=[];
  A.watercolourProfileEnabled=true;
  try{
   for(const [i,mode] of modes.entries()){
    const settings={...base,mode,seed:'WATER-PROFILE-'+i,orientation:i%2?'portrait':'landscape'};
    for(const scale of [.42,1]){
     const c=document.createElement('canvas'),start=performance.now();
     A.renderWatercolourV2S(c,settings,scale,false);
     const p=A.lastWatercolourDetailedProfile;
     if(!p||!p.flow)throw Error('No profile in '+mode);
     results.push({mode,scale,width:c.width,height:c.height,totalMs:performance.now()-start,
       stages:p.stages,flow:p.flow});
    }
   }
  }finally{delete A.watercolourProfileEnabled;}
  return results;
 },modes);
 for(const x of records){assert(Object.values(x.stages).every(Number.isFinite));assert(Object.values(x.flow.stages).every(Number.isFinite));console.log('WATERCOLOUR_PHASE_PROFILE '+JSON.stringify(x));}
}finally{await browser.close();}
