// Oil Paint V2 Stage D — actual ALGO/ART reference / Stage C / refined comparison.
// This script never uses image generation or changes the live site.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const dir='oil-stage-d-results';
await mkdir(dir,{recursive:true});
const cases=[
 {mode:'organic',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-01'},
 {mode:'rects',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-02'},
 {mode:'network',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-03'},
 {mode:'burst',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-04'}
];
const bytes=url=>Buffer.from(url.substring(url.indexOf(',')+1),'base64');
const browser=await chromium.launch({headless:true});
const report=[];
let passed=true;
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 page.setDefaultTimeout(120000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'?v=9&seed=OIL-STAGE-D-START&mode=organic&material=oil-v1',
   {waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV1==='function');
 await page.addScriptTag({url:new URL('js/oil-stage-c-brush.js',root).href});
 for(const spec of cases){
  const result=await page.evaluate(spec=>{
   const A=window.AlgoArt;
   const s={...A.readSettings(),...spec,palette:'golden',
     colourCount:8,saturation:86,brightness:55,
     density:67,elements:48,complexity:65,negativeSpace:52};
   function run(variant){
     A.oilStageCExperimental=variant!=='v1';
     A.oilStageDRefinement=variant==='refined';
     A.oilBrushPerfExperimental=true;
     A.oilPerfExperimental=true;
     A.oilStageCScale=.65;
     A.oilStageCStats={};
     try{
       const c=document.createElement('canvas');
       const start=performance.now(),meta=A.renderOilPaintV1(c,s,.65,false);
       return {ms:performance.now()-start,data:c.toDataURL('image/png'),
         size:[c.width,c.height],
         geometry:JSON.stringify({guide:meta.guide,voids:meta.voids,strategy:meta.strategy}),
         stats:{...A.oilStageCStats},
         raisedPixels:A.lastOilPaintV4EStats?.height?.heightActivePixels||0
       };
     }finally{
       A.oilStageCExperimental=false;A.oilStageDRefinement=false;
       A.oilBrushPerfExperimental=false;A.oilPerfExperimental=false;
       A.oilStageCScale=null;A.oilStageCStats=null;
     }
   }
   for(const v of ['v1','stageC','refined'])run(v); // warm
   const baseline=run('v1');
   const stageC=run('stageC');
   const refined=run('refined');
   const repeat=run('refined');
   return {baseline,stageC,refined,
     deterministic:refined.data===repeat.data};
  },spec);
  const name=spec.mode+'-'+spec.orientation;
  for(const [key,label] of [['baseline','v1'],['stageC','stage-c'],['refined','refined']])
    await writeFile(dir+'/'+name+'-'+label+'.png',bytes(result[key].data));
  const m={name,
    dimensions:result.refined.size,
    v1Ms:+result.baseline.ms.toFixed(1),
    stageCMs:+result.stageC.ms.toFixed(1),
    refinedMs:+result.refined.ms.toFixed(1),
    refinedVsV1Percent:+(100*(result.refined.ms-result.baseline.ms)/result.baseline.ms).toFixed(1),
    refinedVsCPercent:+(100*(result.refined.ms-result.stageC.ms)/result.stageC.ms).toFixed(1),
    changedFromV1:result.refined.data!==result.baseline.data,
    changedFromC:result.refined.data!==result.stageC.data,
    deterministic:result.deterministic,
    geometryMatches:result.baseline.geometry===result.stageC.geometry&&
      result.baseline.geometry===result.refined.geometry,
    stageCBrushCalls:result.stageC.stats.brushCalls||0,
    refinedBrushCalls:result.refined.stats.brushCalls||0,
    refinedFallbackCalls:result.refined.stats.fallbackCalls||0,
    refinedHairs:result.refined.stats.physicalHairs||0,
    bent:result.refined.stats.bent||0,
    exhausted:result.refined.stats.exhausted||0,
    dryGaps:result.refined.stats.dryGaps||0,
    refinedBatchPaintCalls:result.refined.stats.batchPaintCalls||0,
    stageCBrushMs:+(result.stageC.stats.brushMs||0).toFixed(1),
    refinedBrushMs:+(result.refined.stats.brushMs||0).toFixed(1),
    raisedPixelsV1:result.baseline.raisedPixels,
    raisedPixelsRefined:result.refined.raisedPixels
  };
  console.log('STAGE_D '+JSON.stringify(m));
  report.push(m);
  if(!m.changedFromV1||!m.changedFromC||!m.deterministic||
    !m.geometryMatches||m.refinedHairs<100||m.bent<50||m.exhausted<1)
    passed=false;
 }
 const lab=await page.evaluate(()=>{
   const A=window.AlgoArt;
   function render(variant){
     const c=document.createElement('canvas');c.width=1120;c.height=590;
     const mask=document.createElement('canvas');mask.width=c.width;mask.height=c.height;
     const ctx=c.getContext('2d'),m=mask.getContext('2d');
     ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,c.width,c.height);
     const specs=[
       {rgb:[209,75,48],profile:'flat',y:93,w:56},
       {rgb:[42,131,176],profile:'filbert',y:228,w:49},
       {rgb:[82,133,71],profile:'dry',y:357,w:53},
       {rgb:[189,133,54],profile:'flat',y:490,w:67}
     ];
     A.oilStageCExperimental=variant!=='v1';
     A.oilStageDRefinement=variant==='refined';
     A.oilStageCScale=1;
     A.oilStageCStats={};
     try{
       for(let i=0;i<specs.length;i++){
         const q=specs[i],points=Array.from({length:41},(_,j)=>{
           const t=j/40;
           return{x:105+820*t,y:q.y+22*Math.sin(t*2.6)+7*Math.sin(t*8.6)};
         });
         A.oilPaintV4ETest.drawContactBrush(ctx,m,points,q.w,q.rgb,
           q.profile,A.makeR('OIL-STAGE-C-LAB-'+i),
           {thickness:.88,drag:.58,bristles:.95});
       }
       return {png:c.toDataURL('image/png'),stats:{...A.oilStageCStats}};
     }finally{
       A.oilStageCExperimental=false;A.oilStageDRefinement=false;
       A.oilStageCScale=null;A.oilStageCStats=null;
     }
   }
   return {v1:render('v1'),stageC:render('stageC'),refined:render('refined')};
 });
 for(const [key,label] of [['v1','v1'],['stageC','stage-c'],['refined','refined']])
   await writeFile(dir+'/brush-lab-'+label+'.png',bytes(lab[key].png));
 if(lab.refined.png===lab.stageC.png||lab.refined.png===lab.v1.png||
   lab.refined.stats.bent<50)passed=false;
 if(errors.length){passed=false;console.log('BROWSER_ERRORS '+errors.join('; '))}
 await writeFile(dir+'/results.json',JSON.stringify({
   cases:report,labStats:{v1:lab.v1.stats,stageC:lab.stageC.stats,refined:lab.refined.stats},
   passed,warning:'Experimental only. Speed is one CI-run comparison, not a guarantee.'
 },null,2));
}finally{await browser.close()}
assert(passed,'Stage D invariant/paint test failed; review real comparison images');
console.log('PASS: refined real oil images, deterministic render, preserved source geometry, varied bristles');
