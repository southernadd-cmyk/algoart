// Cross-material timing baseline. No production rendering changes.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const results=[];
try {
 const page=await browser.newPage({viewport:{width:1450,height:960}});
 page.setDefaultTimeout(180000);
 const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.goto((process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/')+
  '?v=9&seed=MATERIAL-BENCH-INIT&mode=organic&material=oil-v3',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.AlgoArt?.renderOilPaintV3&&
  window.AlgoArt?.renderWatercolourV2S&&window.AlgoArt?.renderOil);
 const cases=[['organic','landscape'],['rects','portrait'],['network','landscape'],['burst','portrait']];
 for(const [mode,orientation] of cases){
  const result=await page.evaluate(({mode,orientation})=>{
    const A=window.AlgoArt;
    const settings={...A.readSettings(),seed:'MATERIAL-BENCH-'+mode+'-'+orientation,
      mode,orientation,palette:'golden',colourCount:7,
      elements:45,density:63,complexity:59,negativeSpace:47};
    const materials=[
      ['marker',(c,s,z)=>A.render(c,s,z,false)],
      ['tissue',(c,s,z)=>A.renderOil(c,s,z,false,7)],
      ['watercolour',(c,s,z)=>A.renderWatercolourV2S(c,s,z,false)],
      ['oil-v3',(c,s,z)=>A.renderOilPaintV3(c,s,z,false)]
    ];
    const rows=[];
    function sample(fn,scale) {
      const canvas=document.createElement('canvas'),started=performance.now();
      const meta=fn(canvas,settings,scale);
      const ms=performance.now()-started;
      // Fast deterministic image hash is NOT used to compare different materials;
      // it checks repeatability within the same renderer and settings.
      const pixels=canvas.getContext('2d',{willReadFrequently:true})
        .getImageData(0,0,canvas.width,canvas.height).data;
      let hash=2166136261;
      for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619)}
      return {ms:+ms.toFixed(2),hash:hash>>>0,width:canvas.width,height:canvas.height,
        version:meta?.version||'marker',calls:meta?.v3BrushCalls||0};
    }
    for(const scale of [.45,1]){
      for(const [material,fn] of materials){
        sample(fn,scale); // warm-up
        const a=sample(fn,scale),b=sample(fn,scale);
        rows.push({mode,orientation,scale,material,ms:+((a.ms+b.ms)/2).toFixed(2),
          minMs:Math.min(a.ms,b.ms),maxMs:Math.max(a.ms,b.ms),
          exact:a.hash===b.hash&&a.width===b.width&&a.height===b.height,
          hash:a.hash,width:a.width,height:a.height,v3BrushCalls:b.calls});
      }
    }
    return rows;
  },{mode,orientation});
  for(const row of result){console.log('MATERIAL_BENCH '+JSON.stringify(row));results.push(row);
    assert(row.exact,'Nondeterministic pixels: '+JSON.stringify(row));}
  assert.deepEqual(errors,[],'Browser errors during '+mode);
 }
 await mkdir('material-benchmark-results',{recursive:true});
 await writeFile('material-benchmark-results/baseline.json',JSON.stringify(results,null,2));
}finally{await browser.close()}
