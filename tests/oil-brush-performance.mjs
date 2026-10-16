// Stage B: genuine ALGO/ART Oil V1 brush arithmetic comparison.
// Explicit test flag keeps production Oil V1 byte-for-byte unchanged.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='oil-brush-performance-results';
await mkdir(out,{recursive:true});
const cases=[
 {mode:'organic',orientation:'landscape',seed:'OIL-BRUSH-ORG-01'},
 {mode:'rects',orientation:'portrait',seed:'OIL-BRUSH-RECT-02'},
 {mode:'network',orientation:'landscape',seed:'OIL-BRUSH-NET-03'},
 {mode:'burst',orientation:'portrait',seed:'OIL-BRUSH-BURST-04'}
];
const browser=await chromium.launch({headless:true});
const report=[];
let matched=true;
try {
 const page=await browser.newPage({viewport:{width:1450,height:960}});
 page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'?v=9&seed=OIL-BRUSH-INIT&mode=organic&material=oil-v1',
  {waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV1==='function');
 for(const spec of cases){
  const result=await page.evaluate(spec=>{
   const A=window.AlgoArt;
   const settings={...A.readSettings(),...spec,
     palette:'golden',colourCount:8,saturation:86,brightness:55,
     density:67,elements:48,complexity:65,negativeSpace:52};
   function run(brush,shared,savePNG){
    A.oilBrushPerfExperimental=brush;
    A.oilPerfExperimental=shared;
    A.oilBrushPerfStats={};
    const canvas=document.createElement('canvas');
    try{
      const start=performance.now();
      const result=A.renderOilPaintV1(canvas,settings,.45,false);
      const ms=performance.now()-start;
      return {
       ms,brush:A.oilBrushPerfStats,
       sourcePhases:A.lastOilPaintV4EStats?.phases,
       dims:[canvas.width,canvas.height],
       work:result.work?.oilV1,
       png:savePNG?canvas.toDataURL('image/png'):null
      };
    }finally{
      A.oilBrushPerfStats=null;
      A.oilBrushPerfExperimental=false;
      A.oilPerfExperimental=false;
    }
   }
   // Initial warm-ups are excluded; each variant is measured alternately.
   run(false,false,false);run(true,false,false);
   run(true,true,false);
   const variants=[
     {id:'baseline',brush:false,shared:false},
     {id:'brush-only',brush:true,shared:false},
     {id:'brush-and-capture',brush:true,shared:true}
   ];
   const samples={};for(const v of variants)samples[v.id]=[];
   for(let i=0;i<3;i++){
     const order=i%2?[...variants].reverse():variants;
     for(const v of order)samples[v.id].push(run(v.brush,v.shared,i===0));
   }
   const summary={};
   for(const v of variants){
     const values=samples[v.id].map(x=>x.ms).sort((a,b)=>a-b);
     const brushTimes=samples[v.id].map(x=>x.brush.totalMs||0).sort((a,b)=>a-b);
     const first=samples[v.id][0];
     summary[v.id]={
       medianMs:+values[1].toFixed(2),
       medianBrushMs:+brushTimes[1].toFixed(2),
       samplesMs:values.map(x=>+x.toFixed(2)),
       calls:first.brush.calls||0,frames:first.brush.frames||0,
       tufts:first.brush.tufts||0,contacts:first.brush.contacts||0,
       runs:first.brush.runs||0,
       dims:first.dims,sourcePhases:first.sourcePhases,
       png:first.png
     };
   }
   return summary;
  },spec);
  const b=result.baseline,o=result['brush-only'],both=result['brush-and-capture'];
  const equivalent=b.png===o.png&&b.png===both.png;
  matched=matched&&equivalent;
  const toBytes=data=>Buffer.from(data.slice(data.indexOf(',')+1),'base64');
  await writeFile(out+'/'+spec.mode+'-'+spec.orientation+'-v1.png',toBytes(b.png));
  await writeFile(out+'/'+spec.mode+'-'+spec.orientation+'-optimized.png',toBytes(both.png));
  for(const x of [b,o,both])delete x.png;
  const entry={case:spec.mode+'-'+spec.orientation,equivalent,
    baseline:b,brushOnly:o,brushAndCapture:both,
    brushGainPct:+((b.medianBrushMs-o.medianBrushMs)/b.medianBrushMs*100).toFixed(1),
    overallGainPct:+((b.medianMs-both.medianMs)/b.medianMs*100).toFixed(1)};
  report.push(entry);
  console.log('OIL_BRUSH '+JSON.stringify(entry));
 }
 assert.deepEqual(errors,[],'Browser errors');
}finally{
 await writeFile(out+'/results.json',JSON.stringify({
  matched,scale:.45,results:report,
  note:'3 warm-browser samples per variant; runner timing variance remains. Do not claim speedup without multi-run confirmation.'
 },null,2));
 await browser.close();
}
assert(matched,'Experimental oil-brush arithmetic changed one or more real artwork PNGs');
console.log('PASS: all experimental Oil brush and source-capture PNGs exactly equal to Oil V1');
