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
  const file=full.endsWith('/')?full+'index.html':full;
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
  if(material==='tissue'||material==='watercolour'||material==='oil')assert.ok(max>=2,material+' should expose an intermediate material checkpoint');
  console.log(material,'stages',max,'status:',status.slice(0,140));
 }
 assert.ok(!errors.length,'Browser errors: '+errors.join(' | '));
 const href=await page.locator('#continueEditing').getAttribute('href');
 assert.ok(href.includes('seed=PP-BROWSER-SMOKE'),'return editor link lost seed');
 console.log('All five material paths rendered and editor return state persisted');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
