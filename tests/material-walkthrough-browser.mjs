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
  if(['action','tissue','watercolour','oil'].includes(material)){
   const parity=await page.evaluate(material=>{
    const A=window.AlgoArt,s=window.__walkthroughTest.settings(),studio=document.createElement('canvas');
    const prior=A.materialStageCapture;
    try{
     A.materialStageCapture=null;
     if(material==='action')A.renderActionPaintingV4(studio,s,.32,false,{version:4,layers:5});
     else if(material==='tissue')A.renderOil(studio,s,1,false,7);
     else if(material==='watercolour')A.renderWatercolourV2S(studio,s,1,false);
     else A.renderOilPaintV7(studio,s,.45,false);
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
   assert.ok(parity.differences<=(material==='tissue'?2:0),material+' final frame differs from same-resolution renderer by '+parity.differences+' channel values');
  }
  if(material==='tissue'||material==='oil'){
   const labels=await page.evaluate(()=>window.__walkthroughTest.labels());
   const expected=material==='tissue'?'Laying the first tissue sheets':'Oil ground prepared';
   assert.ok(labels.includes(expected),material+' missing opening capture: '+expected);
  }
  if(material==='oil'){
   const opening=await page.evaluate(()=>{
    const frames=window.__walkthroughTest.frames();
    const labels=window.__walkthroughTest.labels();
    const ground=labels.indexOf('Oil ground prepared');
    const stroke=labels.indexOf('Adding the first source brushstrokes');
    if(ground<0||stroke<0)return {ground,stroke,changed:0};
    const base=frames[ground].getContext('2d').getImageData(0,0,frames[ground].width,frames[ground].height).data;
    const ink=frames[stroke].getContext('2d').getImageData(0,0,frames[stroke].width,frames[stroke].height).data;
    let changed=0;
    for(let k=0;k<base.length;k+=4)
     if(base[k]!==ink[k]||base[k+1]!==ink[k+1]||base[k+2]!==ink[k+2])changed++;
    return {ground,stroke,changed};
   });
   console.log('Oil ground-to-first-stroke difference:',JSON.stringify(opening));
   assert.ok(opening.ground>=0&&opening.stroke>opening.ground&&opening.changed>0,
    'Oil first source stroke must add real marks beyond the prepared ground');
  }
  console.log(material,'stages',max,'status:',status.slice(0,140));
 }
 assert.ok(!errors.length,'Browser errors: '+errors.join(' | '));
 const href=await page.locator('#continueEditing').getAttribute('href');
 assert.ok(href.includes('seed=PP-BROWSER-SMOKE'),'return editor link lost seed');
 console.log('All five material paths rendered and editor return state persisted');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}


