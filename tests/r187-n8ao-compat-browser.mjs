// Browser smoke of the actual r187 + patched N8AO test, not a frame-rate
// benchmark. Asserts the pipeline never silently falls back to original.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.PHI_TEST_SERVER||'http://127.0.0.1:4173';
const output='r187-n8ao-compat-smoke';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const results=[];
try{
 for(const ao of ['n8ao','ssao']){
  const context=await browser.newContext({viewport:{width:1000,height:650},serviceWorkers:'block'});
  const page=await context.newPage();
  const logs=[],problems=[];
  page.on('pageerror',e=>problems.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')problems.push(m.text());});
  const item={ao,pass:false,problems,logs};
  try{
   const url=base+'/gallery/visit/three-r187-n8ao-fixed.html?debug=1&ao='+ao;
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled ||
     !!window.__galleryStartupError,null,{timeout:85000});
   assert.equal(await page.evaluate(()=>window.__galleryStartupError||null),null,'Gallery startup error');
   assert.equal(await page.locator('#enter').isEnabled(),true,'Enter button must become enabled');
   await page.locator('#enter').evaluate(el=>el.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,
     null,{timeout:35000});
   // Rendering must actually happen, to exercise half-resolution depth target.
   await page.waitForTimeout(1200);
   item.fx=await page.evaluate(()=>({
     active:window.__phiPostFX?.active,
     renderer:window.__phiPostFX?.renderer,
     ao:window.__phiPostFX?.aoProvider,
     errors:window.__phiPostFX?.errors||[],
     error:window.__galleryStartupError||null,
     stage:window.__galleryStage||null
   }));
   assert.equal(item.fx.ao,ao,'Wrong AO provider');
   assert.equal(item.fx.active,true,'Post-processing must remain active');
   assert.equal(item.fx.renderer,'pmndrs','Renderer must not silently fall back');
   assert.deepEqual(item.fx.errors,[],'Post-processing exceptions recorded');
   assert.equal(item.fx.error,null,'Global gallery error');
   const fxErrors=problems.filter(s=>/original renderer fallback|post-processing error|TypeError.*length/i.test(s));
   assert.deepEqual(fxErrors,[],'No post FX error in console');
   await page.screenshot({path:output+'/'+ao+'.png'});
   item.pass=true;
  }catch(error){
   item.error=String(error?.stack||error);
   item.fx??=await page.evaluate(()=>({
     active:window.__phiPostFX?.active,renderer:window.__phiPostFX?.renderer,
     ao:window.__phiPostFX?.aoProvider,errors:window.__phiPostFX?.errors||[],
     gallery:window.__galleryStartupError||null
   })).catch(()=>null);
   await page.screenshot({path:output+'/'+ao+'-failure.png'}).catch(()=>{});
  }finally{
   results.push(item);
   console.log('R187_N8AO_SMOKE '+JSON.stringify(item));
   await context.close();
  }
 }
}finally{await browser.close();}
await writeFile(output+'/results.json',JSON.stringify(results,null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
