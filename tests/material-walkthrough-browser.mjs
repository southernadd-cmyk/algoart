import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root=resolve('.');
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try {
  const path=new URL(req.url,'http://localhost').pathname;
  const full=resolve(root,'.'+decodeURIComponent(path));
  if(full!==root&&!full.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const file=path.endsWith('/')?resolve(full,'index.html'):full;
  const data=await readFile(file);
  const ext=file.slice(file.lastIndexOf('.'));
  res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
try {
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port+'/about/step-by-step/?seed=PP-BROWSER-SMOKE&mode=rects&v=9';
 await page.goto(url,{waitUntil:'load'});
 await page.waitForFunction(()=>document.querySelector('#counter')?.textContent?.includes('/'),{timeout:30000});
 for(const material of ['marker','action','tissue','watercolour','oil']){
  await page.selectOption('#replayMaterial',material);
  await page.waitForFunction(()=>Number(document.querySelector('#step')?.max)>0,{timeout:30000});
  const max=Number(await page.locator('#step').getAttribute('max'));
  assert.ok(max>=1,material+' has no stages');
  await page.locator('#all').click();
  const visible=await page.locator(material==='marker'?'#drawing':'#actionDrawing').evaluate(e=>getComputedStyle(e).display!=='none');
  assert.ok(visible,material+' result not displayed');
  const status=await page.locator('#notice').innerText();
  assert.ok(!status.startsWith('Could not'),material+': '+status);
  if(material==='oil')assert.ok(status.includes('Oil walkthrough ready'), 'Oil loading notice was not cleared: '+status);
  if(material==='tissue'||material==='watercolour'||material==='oil')assert.ok(max>=2,material+' should expose an intermediate material checkpoint');
  if(['tissue','watercolour','oil'].includes(material)){
   const parity=await page.evaluate(material=>{
    const A=window.AlgoArt,s=window.__walkthroughTest.settings(),studio=document.createElement('canvas');
    const prior=A.materialStageCapture;
    try{
     A.materialStageCapture=null;
     if(material==='tissue')A.renderOil(studio,s,1,false,7);
     else if(material==='watercolour')A.renderWatercolourV2S(studio,s,1,false);
     else A.renderOilPaintV4(studio,s,1,false);
     const final=window.__walkthroughTest.frames().at(-1);
     const resized=document.createElement('canvas');
     resized.width=final.width;resized.height=final.height;
     resized.getContext('2d').drawImage(studio,0,0,resized.width,resized.height);
     const a=final.getContext('2d').getImageData(0,0,final.width,final.height).data;
     const b=resized.getContext('2d').getImageData(0,0,resized.width,resized.height).data;
     let differences=0;
     for(let k=0;k<a.length;k++)if(a[k]!==b[k])differences++;
     return {differences,width:final.width,height:final.height};
    }finally{A.materialStageCapture=prior}
   },material);
   assert.ok(parity.differences<=(material==='tissue'?2:0),material+' final frame differs from studio-quality render by '+parity.differences+' channel values');
  }
  if(material==='oil'){
   const opening=await page.evaluate(()=>{
    const frames=window.__walkthroughTest.frames();
    return frames.slice(0,Math.min(8,frames.length)).map((frame,index)=>{
     const data=frame.getContext('2d').getImageData(0,0,frame.width,frame.height).data;
     const paper=frames[0].getContext('2d').getImageData(0,0,frame.width,frame.height).data;
     let changed=0;
     for(let k=0;k<data.length;k+=4)
      if(data[k]!==paper[k]||data[k+1]!==paper[k+1]||data[k+2]!==paper[k+2])changed++;
     return {index,changedPixels:changed};
    });
   });
   console.log('Oil opening frame coverage:',JSON.stringify(opening));
   assert.ok(opening[1].changedPixels<opening.at(-1).changedPixels,
    'Oil opening frames do not build progressively');
  }
  console.log(material,'stages',max,'status:',status.slice(0,140));
 }
 assert.ok(!errors.length,'Browser errors: '+errors.join(' | '));
 const href=await page.locator('#continueEditing').getAttribute('href');
 assert.ok(href.includes('seed=PP-BROWSER-SMOKE'),'return editor link lost seed');
 console.log('All five material paths rendered and editor return state persisted');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
