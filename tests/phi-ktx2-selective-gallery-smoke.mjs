// Compare the real test tower with two selective architectural KTX2 maps.
// Never change live. Compare real lift traversal and renderer diagnostics;
// software WebGL full-gallery screenshots are too slow to capture reliably.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const url='https://southernadd-cmyk.github.io/algoart/test/virtual-gallery/full-engine.html';
const folder='phi-ktx2-selective-gallery-results';
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const records=[];
try{
 for(const mode of ['original','selective']){
  const page=await browser.newPage({viewport:{width:1200,height:700},deviceScaleFactor:1});
  const errors=[],network=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('response',res=>{
   if(/(brick-normal|brick-roughness)\.ktx2/.test(res.url())||
    /Bricks055_(NormalGL|Roughness)\.jpg/.test(res.url()))
    network.push({url:res.url(),status:res.status()});
  });
  const address=new URL(url);
  address.searchParams.set('debug','1');
  if(mode==='selective')address.searchParams.set('ktx2','selective');
  await page.goto(address.href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled||
   !!window.__galleryStartupError,null,{timeout:100000});
  const error=await page.evaluate(()=>window.__galleryStartupError||'');
  assert.equal(error,'','No gallery preparation errors');
  if(mode==='selective'){
   await page.waitForFunction(()=>['loaded','partial-fallback'].includes(window.__phiKTX20?.status),
    null,{timeout:90000});
  }else{
   await page.waitForFunction(()=>['Bricks055_NormalGL.jpg','Bricks055_Roughness.jpg']
    .every(n=>performance.getEntriesByType('resource').some(e=>e.name.includes(n)&&e.responseEnd>0)),
    null,{timeout:90000});
  }
  const diag=await page.evaluate(()=>({
   ktx:window.__phiKTX20||null,errors:window.__galleryStartupError||null,
   otherPilot:window.__phiKTX2Pilot?.status||null
  }));
  if(mode==='selective'){
   assert.equal(diag.ktx?.status,'loaded','Both selected KTX maps load');
   assert.equal(diag.ktx?.loaded,2,'Exactly two maps enabled');
   assert.equal(diag.ktx?.failed,0,'No compression fallbacks');
   assert.equal(diag.ktx?.sceneCandidates,2);
   assert.equal(diag.ktx?.mode,'selective');
   assert.equal(network.filter(x=>x.url.endsWith('.ktx2')&&x.status===200).length,2);
   assert.equal(network.filter(x=>/Bricks055_(NormalGL|Roughness)\.jpg/.test(x.url)).length,0,
    'Selected original brick maps are not redundantly fetched');
  }else assert.equal(diag.ktx,null,'Baseline never requests new KTX assets');
  await page.locator('#enter').click();
  await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,null,{timeout:15000});
  await page.waitForTimeout(2400);
  const receptionRender=await page.evaluate(()=>window.__phiRenderStats||null);
  assert.ok(receptionRender,'Reception rendered at least one frame');
  const button=page.locator('#openLift');
  await button.evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelector('#lift')?.hidden===false,null,{timeout:10000});
  await page.locator('#liftDays button.lift-available:not(.lift-current)').first()
   .evaluate(el=>el.click());
  await page.waitForFunction(()=>window.__phiLiftState?.floor>0&&!window.__phiLiftState?.travelling,
   null,{timeout:110000});
  await page.waitForTimeout(2200);
  const galleryRender=await page.evaluate(()=>window.__phiRenderStats||null);
  assert.ok(galleryRender,'Gallery rendered at least one frame');
  const state=await page.evaluate(()=>({floor:window.__phiLiftState?.floor,
   gpu:(()=>{const gl=document.querySelector('#world')?.getContext('webgl2');const ext=gl?.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER)})(),
   render:window.__phiRenderStats||null,ktx:window.__phiKTX20||null}));
  assert.deepEqual(errors,[],'No unhandled page errors');
  records.push({mode,diag,network,errors,state,receptionRender,galleryRender});
  console.log('SELECTIVE_GALLERY_SMOKE '+JSON.stringify({mode,diag,requests:network.length,
   floor:state.floor,gpu:state.gpu,errors}));
  await page.close();
 }
 assert.equal(records[0].state.floor,records[1].state.floor,'Same gallery floor');
 await writeFile(folder+'/report.json',JSON.stringify(records,null,2));
 console.log('SELECTIVE_GALLERY_SMOKE_PASS');
}finally{await browser.close();}
