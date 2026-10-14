// Non-publishing visual evidence: identical seeds/settings before/after φ
// framing in all three materials. No network or external posting.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const folder='phi-sheet-framing-compare';await mkdir(folder,{recursive:true});
const cases=[
  {mode:'field',seed:'3XHXQ-4616',palette:'neon',orientation:'landscape'},
  {mode:'rects',seed:'LEH92-6799',palette:'mono',orientation:'landscape'},
  {mode:'spiral',seed:'BDS8W-3918',palette:'earth',orientation:'portrait'}
];
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1200,height:850}});
  page.setDefaultTimeout(180000);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const manifest=[];
  for(const c of cases){
    const render=await page.evaluate(c=>{
      const A=window.AlgoArt;
      const original=A.readSettings(),savedFit=A.phiFramingEnabled;
      const settings={...original,...c};
      const samples=[];
      try{
        for(const material of ['marker','tissue','watercolour']){
          for(const fitted of [false,true]){
            A.phiFramingEnabled=fitted;
            A.watercolourV2sOptions.fitToSheet=false;
            const canvas=document.createElement('canvas');
            const t0=performance.now();
            if(material==='marker')A.render(canvas,settings,.58,false);
            else if(material==='tissue')A.renderOil(canvas,settings,.58,false,7);
            else A.renderWatercolourV2S(canvas,settings,.58,false);
            const presentation=A.lastPhiSheetFrame;
            samples.push({material,fitted,
              png:canvas.toDataURL('image/png').split(',')[1],
              transform:presentation,
              timeMs:Math.round(performance.now()-t0)});
          }
        }
      }finally{A.phiFramingEnabled=savedFit;}
      return samples;
    },c);
    assert.equal(render.length,6);
    const entries=[];
    for(const item of render){
      const name=[c.mode,c.orientation,item.material,item.fitted?'phi':'source'].join('-')+'.png';
      const bytes=Buffer.from(item.png,'base64');
      assert(bytes.length>14000,name);
      await writeFile(folder+'/'+name,bytes);
      entries.push({name,bytes:bytes.length,timeMs:item.timeMs,fit:item.transform});
    }
    for(let i=0;i<entries.length;i+=2)
      assert.notEqual(render[i].png,render[i+1].png,
        'Fitting produced no image change for '+c.mode+' '+entries[i].name);
    const transforms=entries.filter((_,i)=>i%2===1).map(e=>e.fit);
    for(const t of transforms.slice(1)){
      assert(Math.abs(t.scale-transforms[0].scale)<1e-12);
      assert(Math.abs(t.tx-transforms[0].tx)<1e-9);
      assert(Math.abs(t.ty-transforms[0].ty)<1e-9);
    }
    manifest.push({...c,entries});
    console.log('PASS phi screenshots',c.mode,entries.map(e=>e.name).join(' | '));
  }
  await writeFile(folder+'/manifest.json',JSON.stringify({
    status:'Experimental — no user-facing release',
    rule:'φ-derived content frame, same source path transform across Marker/Tissue/Watercolour',
    note:'Seed+mode+palette held identical across on/off comparisons, historical links unchanged',
    studies:manifest
  },null,2));
}finally{await browser.close()}
