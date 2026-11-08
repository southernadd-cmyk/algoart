// Browser contact sheet for V9 vs V10 at 12 and 14 colours, all five materials.
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
  for(const colourCount of [12,14]){
    for(const version of [9,10]){
      for(const material of ['marker','tissue','watercolour','oil','action']){
      const sample=await page.evaluate(async ({version,material,colourCount})=>{
        const A=window.AlgoArt;
        const s={...A.readSettings(),seed:'PALETTE-V10-VISUAL-01',
          mode:'field',palette:'primary',colourCount,
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
          summary:{material,version,colourCount,ms:Math.round(performance.now()-t0),
          width:canvas.width,height:canvas.height,chromatic,
          occupiedHueBins:materialHues,hueDistribution:Array.from(buckets)}};
      },{version,material,colourCount});
      await writeFile(dir+'/'+colourCount+'-'+version+'-'+material+'.png',Buffer.from(sample.png,'base64'));
      report.push(sample.summary);
      console.log('PALETTE VISUAL',JSON.stringify(sample.summary));
      }
    }
  }
  for(const material of ['marker','tissue','watercolour','oil','action']){
    const old=report.find(row=>row.material===material&&row.version===9&&row.colourCount===14);
    const next=report.find(row=>row.material===material&&row.version===10&&row.colourCount===14);
    if(!next||!old||!next.chromatic||!next.occupiedHueBins)
      throw Error('No visible colour coverage at slider maximum for '+material);
    console.log('PALETTE 14 COMPARISON '+material+': V9 '+old.occupiedHueBins+
      ' vs V10 '+next.occupiedHueBins+' occupied hue bins');
  }
  // Audit the browser's ACTUAL painted swatches for every palette, not
  // just HSL string distinctness or the primary material example.
  const swatchAudit=await page.evaluate(()=>{
    const A=window.AlgoArt;
    const names=['primary','cmyk','warm','cold','earth','marker',
      'neon','pastel','spectrum','golden','mono'];
    A.rendererVersion=10;
    const canvas=document.createElement('canvas');
    canvas.width=930;canvas.height=names.length*50+20;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,canvas.width,canvas.height);
    const report=[];
    for(const [row,name] of names.entries()){
      const inks=A.hues({...A.readSettings(),palette:name,colourCount:14,
        saturation:82,brightness:53},A.makeR('V10-ALL-PALETTES'));
      const rgb=[],hueAngles=[];
      const y=10+row*50;
      ctx.fillStyle='#24211e';ctx.font='14px sans-serif';
      ctx.fillText(name.toUpperCase(),10,y+25);
      for(let i=0;i<14;i++){
        const x=135+i*56;
        ctx.fillStyle=inks[i];
        ctx.fillRect(x,y,53,40);
        const pixel=ctx.getImageData(x+26,y+20,1,1).data;
        rgb.push([...pixel.slice(0,3)].join(','));
        hueAngles.push(Number(/^hsl\(([-.\d]+)/.exec(inks[i])[1]));
      }
      if(new Set(rgb).size!==14)
        throw Error(name+' 14-colour CSS swatches collapsed into duplicate RGB values');
      if(name!=='mono'){
        if(new Set(hueAngles).size!==14)
          throw Error(name+' has fewer than 14 hue angles in the browser');
        for(let a=0;a<14;a++)for(let b=a+1;b<14;b++){
          const diff=Math.abs(hueAngles[a]-hueAngles[b]);
          if(Math.min(diff,360-diff)<6-1e-7)
            throw Error(name+' has near-duplicate hue angles');
        }
      }
      report.push({palette:name,swatches:rgb.length,uniqueRGB:new Set(rgb).size,
        distinctHues:new Set(hueAngles).size});
    }
    return{png:canvas.toDataURL('image/png').split(',')[1],report};
  });
  await writeFile(dir+'/14-colour-all-palettes.png',
    Buffer.from(swatchAudit.png,'base64'));
  console.log('PALETTE SWATCH AUDIT',JSON.stringify(swatchAudit.report));
  if(failures.length)throw Error('Page errors: '+failures.join('; '));
  await writeFile(dir+'/report.json',JSON.stringify(report,null,2));
}finally{await browser.close()}
console.log('PASS 20 real browser images: five materials at 12 and 14 colours, V9 vs V10, saved in '+dir);
