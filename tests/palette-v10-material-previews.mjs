// Browser contact sheet for V9 vs V10 at the same seed and all five materials.
// Saves real rendered PNGs and a hue-coverage audit; never publishes artwork.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const dir='preview/palette-v10';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const report=[];
try{
  const page=await browser.newPage({viewport:{width:1450,height:950}});
  page.setDefaultTimeout(300000);
  const failures=[];
  page.on('pageerror',e=>failures.push(e.message));
  await page.goto(root+'?v=10&mode=field&seed=PALETTE-V10-VISUAL-01&pal=primary&cols=12',
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.AlgoArt?.readSettings&&
    window.AlgoArt?.renderReleasedOilPaintV8&&
    window.AlgoArt?.renderActionPaintingV4&&
    window.AlgoArt?.renderWatercolourV2S,null,{timeout:300000});
  for(const version of [9,10]){
    for(const material of ['marker','tissue','watercolour','oil','action']){
      const sample=await page.evaluate(async ({version,material})=>{
        const A=window.AlgoArt;
        const s={...A.readSettings(),seed:'PALETTE-V10-VISUAL-01',
          mode:'field',palette:'primary',colourCount:12,
          elements:42,density:65,complexity:70,negativeSpace:35,
          saturation:82,brightness:53,paper:'#f5f0e6',grain:0};
        A.rendererVersion=version;
        A.phiFramingEnabled=false;
        if(A.watercolourV2sOptions)A.watercolourV2sOptions.fitToSheet=false;
        const canvas=document.createElement('canvas');
        const t0=performance.now();
        if(material==='marker')A.render(canvas,s,.30,false);
        else if(material==='tissue')A.renderOil(canvas,s,.30,false,7);
        else if(material==='watercolour')A.renderWatercolourV2S(canvas,s,.30,false);
        else if(material==='oil')A.renderReleasedOilPaintV8(canvas,s,.30,false);
        else if(material==='action')A.renderActionPaintingV4(canvas,s,.30,false,{version:4});
        const {data}=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
        const buckets=new Uint32Array(24);
        let chromatic=0;
        for(let i=0;i<data.length;i+=4){
          const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;
          const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
          if(max<.12||d<.14||max===0)continue;
          const sat=d/max;
          if(sat<.20)continue;
          let h;
          if(max===r)h=(g-b)/d%6;
          else if(max===g)h=(b-r)/d+2;
          else h=(r-g)/d+4;
          h=(h*60+360)%360;
          buckets[Math.floor(h/15)%24]++;
          chromatic++;
        }
        const materialHues=Array.from(buckets).filter(v=>v>chromatic*.006).length;
        return {png:canvas.toDataURL('image/png').split(',')[1],
          summary:{material,version,ms:Math.round(performance.now()-t0),
          width:canvas.width,height:canvas.height,chromatic,
          occupiedHueBins:materialHues,hueDistribution:Array.from(buckets)}};
      },{version,material});
      await writeFile(dir+'/'+version+'-'+material+'.png',Buffer.from(sample.png,'base64'));
      report.push(sample.summary);
      console.log('PALETTE VISUAL',JSON.stringify(sample.summary));
    }
  }
  if(failures.length)throw Error('Page errors: '+failures.join('; '));
  await writeFile(dir+'/report.json',JSON.stringify(report,null,2));
}finally{await browser.close()}
console.log('PASS 10 real browser material images saved in '+dir);
