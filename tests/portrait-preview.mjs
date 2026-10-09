// Browser preview snapshots for the isolated portrait feature branch.
// Run after: python3 -m http.server 8765 (from repository root).
// Then: node tests/portrait-preview.mjs
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'];
const base=process.env.PREVIEW_URL||'http://127.0.0.1:8765/';
const folder=new URL('../preview/screenshots/',import.meta.url);
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:980},deviceScaleFactor:1});
const observations=[];
const images={landscape:[],portrait:[]};
const JS_ERRORS=[];
page.on('pageerror',err=>JS_ERRORS.push(String(err)));

async function collect(orientation,mode){
  const url=new URL(base);
  url.searchParams.set('v','6');
  url.searchParams.set('seed','PORTRAIT-PREVIEW-2026');
  url.searchParams.set('mode',mode);
  url.searchParams.set('fmt',orientation);
  await page.goto(url.toString(),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.AlgoArt?.lastRenderMeta?.strategy&&document.querySelector('#art')?.width>0,{timeout:15000});
  const output=await page.evaluate(()=>{
    const c=document.querySelector('#art');
    const ctx=c.getContext('2d',{willReadFrequently:true});
    const {width:w,height:h}=c;
    const bg=ctx.getImageData(0,0,1,1).data;
    const pix=ctx.getImageData(0,0,w,h).data;
    let ink=0,total=0,top=0,bottom=0,left=0,right=0;
    for(let y=6;y<h-6;y+=8){
      for(let x=6;x<w-6;x+=8){
        const i=(y*w+x)*4;
        const contrast=Math.abs(pix[i]-bg[0])+Math.abs(pix[i+1]-bg[1])+Math.abs(pix[i+2]-bg[2]);
        if(contrast>40){
          ink++;
          if(y<h/2)top++;else bottom++;
          if(x<w/2)left++;else right++;
        }
        total++;
      }
    }
    return {png:c.toDataURL('image/png'),width:w,height:h,inkFraction:ink/total,top,bottom,left,right,
      strategy:window.AlgoArt.lastRenderMeta.strategy,
      voidCount:window.AlgoArt.lastRenderMeta.voids.length,
      settingsOrientation:window.AlgoArt.readSettings().orientation};
  });
  assert.equal(output.width,orientation==='portrait'?1000:1400);
  assert.equal(output.height,orientation==='portrait'?1400:1000);
  assert.ok(output.inkFraction>0.0003,mode+' '+orientation+' appears blank');
  const file=new URL(mode+'-'+orientation+'.png',folder);
  await writeFile(file,Buffer.from(output.png.split(',')[1],'base64'));
  images[orientation].push({mode,png:output.png});
  delete output.png;
  observations.push({orientation,mode,...output});
}

async function contactSheet(orientation){
  const items=images[orientation];
  const sheet=await page.evaluate(async ({orientation,items})=>{
    const cvs=document.createElement('canvas');
    const cellWidth=258,cellHeight=orientation==='portrait'?366:255;
    cvs.width=cellWidth*4;
    cvs.height=cellHeight*2;
    const cx=cvs.getContext('2d');
    cx.fillStyle='#dedbd5';cx.fillRect(0,0,cvs.width,cvs.height);
    for(let i=0;i<items.length;i++){
      const img=new Image();img.src=items[i].png;
      await img.decode();
      const x=(i%4)*cellWidth,y=Math.floor(i/4)*cellHeight;
      cx.fillStyle='#fff';cx.fillRect(x+7,y+7,cellWidth-14,cellHeight-14);
      const maxWidth=cellWidth-24,maxHeight=cellHeight-40;
      const drawWidth=Math.min(maxWidth,maxHeight*img.width/img.height);
      const drawHeight=drawWidth*img.height/img.width;
      cx.drawImage(img,x+(cellWidth-drawWidth)/2,y+12+(maxHeight-drawHeight)/2,drawWidth,drawHeight);
      cx.fillStyle='#111';cx.font='bold 14px monospace';cx.fillText(items[i].mode.toUpperCase(),x+14,y+cellHeight-12);
    }
    return cvs.toDataURL('image/png');
  },{orientation,items});
  await writeFile(new URL(orientation+'-contact.png',folder),Buffer.from(sheet.split(',')[1],'base64'));
}

try {
  for(const orientation of ['landscape','portrait']){
    for(const mode of modes)await collect(orientation,mode);
    await contactSheet(orientation);
  }
  // Responsive stage check at a mobile viewport.
  await page.setViewportSize({width:390,height:844});
  const mobile=new URL(base);mobile.searchParams.set('v','6');
  mobile.searchParams.set('mode','organic');mobile.searchParams.set('seed','PORTRAIT-PREVIEW-2026');mobile.searchParams.set('fmt','portrait');
  await page.goto(mobile.toString(),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#art')?.height===1400);
  const metrics=await page.evaluate(()=>{
    const rect=document.querySelector('.canvas-wrap').getBoundingClientRect();
    return {canvasWidth:rect.width,canvasHeight:rect.height,windowWidth:innerWidth,
      overflowX:document.documentElement.scrollWidth>innerWidth+2};
  });
  assert.ok(metrics.canvasWidth>0&&metrics.canvasWidth<=390,'portrait overflows mobile width');
  assert.ok(Math.abs(metrics.canvasHeight/metrics.canvasWidth-1.4)<0.025,'wrong portrait CSS aspect ratio');
  assert.equal(metrics.overflowX,false,'mobile page has horizontal overflow');
  if(JS_ERRORS.length)throw Error('Browser script exceptions: '+JS_ERRORS.join(' / '));
  await writeFile(new URL('report.json',folder),JSON.stringify({observations,mobile:metrics,errors:JS_ERRORS},null,2)+'\n');
  console.log('PASS: 16 browser previews saved; portrait/landscape canvas dimensions and nonblank content verified; mobile canvas aspect and overflow verified.');
} finally {
  await browser.close();
}
