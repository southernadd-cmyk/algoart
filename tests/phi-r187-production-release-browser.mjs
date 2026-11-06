// Release gate for production index.html with Three.js r187 + N8AO 2.0.1 MRT fix.
// Test both AO choices; NEVER allow a silent renderer fallback to count as success.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const root=process.env.PHI_TEST_SERVER||'http://127.0.0.1:4173';
const dir='r187-production-release-check';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const results=[];
try{
 for(const ao of ['n8ao','ssao']){
  const context=await browser.newContext({viewport:{width:1000,height:650},serviceWorkers:'block'});
  const page=await context.newPage();
  const problems=[];
  page.on('pageerror',e=>problems.push('pageerror '+String(e)));
  page.on('console',m=>{if(m.type()==='error')problems.push('console '+m.text())});
  const entry={ao,pass:false,problems};
  try{
   await page.goto(root+'/gallery/visit/index.html?debug=1&ao='+ao,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled ||
    !!window.__galleryStartupError,null,{timeout:85000});
   assert.equal(await page.evaluate(()=>window.__galleryStartupError||null),null,'Startup should not error');
   assert.equal(await page.locator('#enter').isEnabled(),true,'Enter button should be enabled');
   await page.locator('#enter').evaluate(el=>el.click());
   await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,null,{timeout:35000});
   // Several render cycles, sufficient to trigger the N8AO half-resolution MRT path.
   await page.waitForTimeout(1500);
   entry.state=await page.evaluate(()=>({
    active:window.__phiPostFX?.active,
    renderer:window.__phiPostFX?.renderer,
    provider:window.__phiPostFX?.aoProvider,
    errors:window.__phiPostFX?.errors||[],
    globalError:window.__galleryStartupError||null
   }));
   assert.equal(entry.state.active,true,'Post-processing not active');
   assert.equal(entry.state.renderer,'pmndrs','Post-processing silently fell back');
   assert.equal(entry.state.provider,ao,'Wrong AO provider');
   assert.deepEqual(entry.state.errors,[],'Post FX exceptions present');
   assert.equal(entry.state.globalError,null);
   assert.deepEqual(problems.filter(x=>/original renderer fallback|post-processing error|Cannot read properties of undefined.*length/i.test(x)),[]);
   await page.screenshot({path:dir+'/'+ao+'.png'});
   entry.pass=true;
  }catch(error){
   entry.error=String(error.stack||error);
   entry.state??=await page.evaluate(()=>({
    active:window.__phiPostFX?.active,
    renderer:window.__phiPostFX?.renderer,
    provider:window.__phiPostFX?.aoProvider,
    errors:window.__phiPostFX?.errors||[]
   })).catch(()=>null);
   await page.screenshot({path:dir+'/'+ao+'-failure.png'}).catch(()=>{});
  }finally{
   results.push(entry);
   console.log('R187_PRODUCTION_RELEASE '+JSON.stringify(entry));
   await context.close();
  }
 }
}finally{await browser.close();}
await writeFile(dir+'/results.json',JSON.stringify(results,null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
