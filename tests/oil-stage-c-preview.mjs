// ALGO/ART Stage C: genuine oil-brush comparison, never model-generated imagery.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='oil-stage-c-results';
await mkdir(out,{recursive:true});
const seeds=[
 {mode:'organic',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-01'},
 {mode:'rects',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-02'},
 {mode:'network',orientation:'landscape',seed:'OIL-STAGE-C-COLOUR-03'},
 {mode:'burst',orientation:'portrait',seed:'OIL-STAGE-C-COLOUR-04'}
];
const browser=await chromium.launch({headless:true});
let failed=false;
const cases=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 page.setDefaultTimeout(120000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'?v=9&seed=OIL-STAGE-C-START&mode=organic&material=oil-v1',
   {waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV1==='function');
 // The actual experimental brush is a separate file, NEVER loaded on production.
 await page.addScriptTag({url:new URL('js/oil-stage-c-brush.js',root).href});
 const png=data=>Buffer.from(data.slice(data.indexOf(',')+1),'base64');
 for(const spec of seeds){
  const data=await page.evaluate(({spec})=>{
   const A=window.AlgoArt;
   const s={...A.readSettings(),...spec,palette:'golden',colourCount:8,
      saturation:86,brightness:55,density:67,elements:48,
      complexity:65,negativeSpace:52};
   const doRender=stageC=>{
    A.oilBrushPerfExperimental=true;A.oilPerfExperimental=true;
    A.oilStageCExperimental=stageC;A.oilStageCScale=.65;A.oilStageCStats={};
    let canvas=document.createElement('canvas');
    try{
      const start=performance.now();
      const meta=A.renderOilPaintV1(canvas,s,.65,false);
      return {ms:performance.now()-start,
       png:canvas.toDataURL('image/png'),size:[canvas.width,canvas.height],
       oilStats:A.oilStageCStats,bristleContacts:A.lastOilPaintV4EStats?.bristleContacts,
       heightActivePixels:A.lastOilPaintV4EStats?.height?.heightActivePixels,
       sourceGuide:JSON.stringify(meta.guide||null),
       protectedVoids:JSON.stringify(meta.voids||[]),
       work:meta.work?.oilV1};
    }finally{
      A.oilBrushPerfExperimental=false;A.oilPerfExperimental=false;
      A.oilStageCExperimental=false;A.oilStageCScale=null;A.oilStageCStats=null;
    }
   };
   // Warm both render paths.
   doRender(false);doRender(true);
   const v1=doRender(false),v2=doRender(true),repeat=doRender(true);
   return {v1,v2,repeatMatches:v2.png===repeat.png};
  },{spec});
  const name=spec.mode+'-'+spec.orientation;
  await writeFile(out+'/'+name+'-oil-v1.png',png(data.v1.png));
  await writeFile(out+'/'+name+'-oil-v2-stage-c.png',png(data.v2.png));
  const identical=data.v1.png===data.v2.png,
        geometrySame=data.v1.sourceGuide===data.v2.sourceGuide,
        voidsSame=data.v1.protectedVoids===data.v2.protectedVoids,
        one=data.v2.oilStats?.physicalHairs||0;
  const record={name,dimensions:data.v2.size,imagesDifferent:!identical,
    repeatDeterministic:data.repeatMatches,geometrySame,voidsSame,
    v1Ms:+data.v1.ms.toFixed(1),v2Ms:+data.v2.ms.toFixed(1),
    overheadPercent:+(100*(data.v2.ms-data.v1.ms)/data.v1.ms).toFixed(1),
    v2BrushCalls:data.v2.oilStats?.brushCalls||0,
    v2FallbackCalls:data.v2.oilStats?.fallbackCalls||0,
    v2PhysicalHairs:one,v2HairRuns:data.v2.oilStats?.runs||0,
    v2HairFootprints:data.v2.oilStats?.footprints||0,
    v2BrushMs:+(data.v2.oilStats?.brushMs||0).toFixed(1),
    oilV1Contacts:data.v1.bristleContacts,
    oilV2Contacts:data.v2.bristleContacts,
    v1RaisedPixels:data.v1.heightActivePixels,
    v2RaisedPixels:data.v2.heightActivePixels};
  cases.push(record);
  console.log('STAGE_C '+JSON.stringify(record));
  if(identical||!geometrySame||!voidsSame||!data.repeatMatches||one<100)failed=true;
 }
 const lab=await page.evaluate(()=>{
  const A=window.AlgoArt;
  function lab(stageC){
    const canvas=document.createElement('canvas');
    canvas.width=1120;canvas.height=590;
    const maskCanvas=document.createElement('canvas');
    maskCanvas.width=1120;maskCanvas.height=590;
    const ctx=canvas.getContext('2d'),mask=maskCanvas.getContext('2d');
    const swatches=[
     {color:[209,75,48],profile:'flat',y:93,width:56},
     {color:[42,131,176],profile:'filbert',y:228,width:49},
     {color:[82,133,71],profile:'dry',y:357,width:53},
     {color:[189,133,54],profile:'flat',y:490,width:67}
    ];
    ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,1120,590);
    A.oilStageCExperimental=stageC;A.oilStageCScale=1;A.oilStageCStats={};
    for(let i=0;i<swatches.length;i++){
      const q=swatches[i];
      const points=Array.from({length:41},(_,j)=>{
       const t=j/40;
       return {x:105+820*t,y:q.y+22*Math.sin(t*2.6)+7*Math.sin(t*8.6)};
      });
      A.oilPaintV4ETest.drawContactBrush(ctx,mask,points,
         q.width,q.color,q.profile,A.makeR('OIL-STAGE-C-LAB-'+i),
         {thickness:.88,drag:.58,bristles:.95});
    }
    A.oilStageCExperimental=false;A.oilStageCScale=null;
    const stats=A.oilStageCStats;
    A.oilStageCStats=null;
    return {png:canvas.toDataURL('image/png'),stats};
  }
  return {before:lab(false),after:lab(true)};
 });
 await writeFile(out+'/brush-contact-v1.png',png(lab.before.png));
 await writeFile(out+'/brush-contact-v2.png',png(lab.after.png));
 await writeFile(out+'/metrics.json',JSON.stringify({
    cases,lab:{before:lab.before.stats,after:lab.after.stats},
    stage:'C',label:'REAL ALGO/ART Oil v1 source geometry / physical bristle deposits',
    warning:'V2 is experimental, not published or approved for release.'},null,2));
 if(lab.before.png===lab.after.png||lab.after.stats.physicalHairs<120)failed=true;
 if(errors.length)throw new Error('Browser errors: '+errors.join('; '));
}finally{await browser.close()}
assert(!failed,'Oil v2 Stage C did not meet smoke-test acceptance criteria; inspect metrics and images');
console.log('PASS: four real ALGO/ART oil comparisons, varied pigment-and-height bristles, deterministic V2 and unchanged composition');
