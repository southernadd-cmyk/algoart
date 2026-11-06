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
  // Oil yields two animation frames before rendering. Its previous material
  // keeps the old slider max until capture finishes; wait for the ready signal.
  await page.waitForFunction(expected=>{
   const max=Number(document.querySelector('#step')?.max);
   if(!(max>0))return false;
   const notice=document.querySelector('#notice')?.textContent||'';
   return expected!=='oil'||notice.includes('Oil walkthrough ready');
  },material,{timeout:120000});
  const max=Number(await page.locator('#step').getAttribute('max'));
  assert.ok(max>=1,material+' has no stages');
  await page.locator('#all').click();
  const visible=await page.locator(material==='marker'?'#drawing':'#actionDrawing').evaluate(e=>getComputedStyle(e).display!=='none');
  assert.ok(visible,material+' result not displayed');
  // 'Show finished drawing' must produce the exact clean final image, even
  // when the guide/highlight controls are enabled.
  const finalState=await page.evaluate(material=>{
   const step=document.querySelector('#step');
   const controls={value:+step.value,max:+step.max,clean:true};
   if(material==='marker'){
    const markup=document.querySelector('#drawing').innerHTML;
    controls.clean=!markup.includes('stroke=\"#b0873b\"')&&!markup.includes('stroke=\"#b65368\"');
   }else{
    const actual=document.querySelector('#actionDrawing');
    const expected=window.__walkthroughTest.frames().at(-1);
    const a=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data;
    const b=expected.getContext('2d').getImageData(0,0,expected.width,expected.height).data;
    if(a.length!==b.length)controls.clean=false;
    else for(let k=0;k<a.length;k++)if(a[k]!==b[k]){controls.clean=false;break;}
   }
   return controls;
  },material);
  assert.equal(finalState.value,finalState.max,material+' show all did not reach the final step');
  assert.ok(finalState.clean,material+' finished artwork contains replay overlays');
  await page.locator('#prev').click();
  assert.equal(+await page.locator('#step').inputValue(),max-1,material+' previous did not step back');
  await page.locator('#next').click();
  assert.equal(+await page.locator('#step').inputValue(),max,material+' next did not step forward');
  const optionValues=await page.locator('#stepLevel option').evaluateAll(items=>items.map(x=>x.value));
  if(optionValues.length>1){
   await page.selectOption('#stepLevel',optionValues.at(-1));
   const detailSteps=+await page.locator('#step').getAttribute('max');
   assert.ok(detailSteps>=max-1,material+' more detailed level became shorter');
   await page.selectOption('#stepLevel',optionValues[0]);
   assert.equal(+await page.locator('#step').inputValue(),+await page.locator('#step').getAttribute('max'),material+' lost final progress on level change');
  }
  if(['tissue','watercolour','oil'].includes(material)){
   const retained=await page.evaluate(()=>window.__walkthroughTest.frames().length);
   assert.ok(retained<=48,material+' exceeded the 48-frame memory cap: '+retained);
  }
  // Real playback interaction: Play advances, Pause stops, and manual seek
  // does not leave an old timeout playing in the background.
  await page.locator('#step').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#play').click();
  await page.waitForFunction(()=>+document.querySelector('#step').value>0,{timeout:6000});
  await page.locator('#play').click();
  const pausedStep=+await page.locator('#step').inputValue();
  await page.waitForTimeout(1000);
  assert.equal(+await page.locator('#step').inputValue(),pausedStep,material+' resumed after pause');
  await page.locator('#all').click();
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
     else if(A.defaultOilPaintMaterial==='oil-v8')A.renderReleasedOilPaintV8(studio,s,.45,false);
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
    const stroke=Math.max(labels.indexOf('Adding the first source brushstrokes'),labels.indexOf('Adding source brushstrokes'));
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


