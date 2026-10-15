// Real V4 brush laboratory: raw procedural canvas pixels, not a page screenshot.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const root='oil-v4-results/lab';
await mkdir(root,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/',
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.addScriptTag({url:'/js/oil-paint-v4.js'});
  const result=await page.evaluate(()=>{
    const A=window.AlgoArt;
    const canvas=document.createElement('canvas');
    const stats=A.oilPaintV4Test.drawBrushLab(canvas,
      {seed:'OIL-V4-LAB-FIXED',scale:1});
    const first=canvas.toDataURL('image/png');
    const comparison=document.createElement('canvas');
    A.oilPaintV4Test.drawBrushLab(comparison,
      {seed:'OIL-V4-LAB-FIXED',scale:1});
    const identical=first===comparison.toDataURL('image/png');
    const crops=[];
    for(let i=0;i<4;i++){
      for(const factor of [1,2]){
        const x=22+300*1,y=38+i*210,w=250,h=155;
        const target=document.createElement('canvas');
        target.width=w*factor;target.height=h*factor;
        const c=target.getContext('2d');
        c.imageSmoothingEnabled=factor===1;
        c.drawImage(canvas,x,y,w,h,0,0,target.width,target.height);
        crops.push({profile:['filbert','flat','dry','knife'][i],factor,
          base64:target.toDataURL('image/png').split(',')[1]});
      }
    }
    return {stats,identical,raw:first.split(',')[1],crops};
  });
  assert.equal(result.identical,true,'Same seed must reproduce identical brush pixels');
  assert.equal(result.stats.studies,16,'Expected four profiles x four stroke cases');
  assert(result.stats.stats.every(s=>s.bristleRuns>0),
    'All brush profiles must deposit actual directional marks');
  assert(result.stats.height.heightP95>.07,'Actual deposited paint relief is missing');
  assert.deepEqual(errors,[]);
  await writeFile(root+'/oil-v4-brush-lab.png',Buffer.from(result.raw,'base64'));
  for(const p of result.crops){
    await writeFile(root+'/'+p.profile+'-'+(p.factor===1?'100':'200')+'pct.png',
      Buffer.from(p.base64,'base64'));
  }
  const manifest={...result.stats,diagnostic:
    'Real Canvas2D curved brush primitives, four brush shapes x four stroke paths',
    baseline:'Oil V3c; lab uses no AI generation or source screenshots',
    determinism:result.identical,output:'one sheet, 4 full-resolution details, 4 2x nearest-neighbour details'};
  await writeFile(root+'/oil-v4-lab-manifest.json',JSON.stringify(manifest,null,2));
  console.log('PASS V4 real brush laboratory, profiles',result.stats.profiles.join(','),
    'height P95',result.stats.height.heightP95);
}finally{await browser.close()}
