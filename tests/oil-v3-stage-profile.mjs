// Profile Oil V3 production brush stages without altering paint geometry.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 page.setDefaultTimeout(180000);
 await page.goto('http://127.0.0.1:4173/?v=9&seed=OIL-PROFILE-INIT&mode=organic&material=oil-v3',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV3==='function');
 const rows=await page.evaluate(()=>{
  const A=window.AlgoArt,base=A.readSettings(),result=[];
  for(const [mode,orientation] of [['organic','landscape'],['rects','portrait'],['network','landscape'],['burst','portrait']]){
   const s={...base,seed:'MATERIAL-BENCH-'+mode+'-'+orientation,mode,orientation,palette:'golden',
      colourCount:7,elements:45,density:63,complexity:59,negativeSpace:47};
   const render=profiled=>{
    const c=document.createElement('canvas');A.oilV3StageProfile=profiled?{
      brushCalls:0,pathMs:0,toothMs:0,depositMs:0,compositeMs:0}:null;
    const start=performance.now();A.renderOilPaintV3(c,s,1,false);
    const elapsed=performance.now()-start;
    const profile=A.oilV3StageProfile;A.oilV3StageProfile=null;
    const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let hash=2166136261;for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i],16777619);
    return {elapsed,profile,hash:hash>>>0,width:c.width,height:c.height};
   };
   render(false);render(true);
   const control=render(false),instrumented=render(true);
   result.push({mode,exact:control.hash===instrumented.hash&&control.width===instrumented.width&&control.height===instrumented.height,
      baselineMs:+control.elapsed.toFixed(2),profiledMs:+instrumented.elapsed.toFixed(2),...instrumented.profile,
      unaccountedMs:+(instrumented.elapsed-(instrumented.profile.pathMs+instrumented.profile.toothMs+
         instrumented.profile.depositMs+instrumented.profile.compositeMs)).toFixed(2)});
  }return result;
 });
 for(const row of rows){console.log('OIL_STAGE_PROFILE '+JSON.stringify(row));assert(row.exact,'Pixel mismatch '+row.mode)}
}finally{await browser.close()}
