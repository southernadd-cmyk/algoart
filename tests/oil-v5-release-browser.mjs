// Real studio routing/export/replay checks. No public posts or archive writes.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {validateOilItem} from '../automation/oil-slot.mjs';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='oil-v7-release-results';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
const results=[];
try{
 const context=await browser.newContext({viewport:{width:1400,height:1000},acceptDownloads:true});
 await context.addInitScript(()=>{
  localStorage.setItem('algoart-intro-seen','1');localStorage.setItem('algoart-ethos-seen','1');
  localStorage.setItem('algoart-inspector-desktop','open');localStorage.setItem('algoart-inspector-mobile','open');
  window.AlgoArt=window.AlgoArt||{};
  for(let n=1;n<=7;n++){
   let render;Object.defineProperty(window.AlgoArt,'renderOilPaintV'+n,{configurable:true,
    get(){return render},set(fn){render=function(...args){const meta=fn.apply(this,args);
     if(args[0].id==='art')window.__oilRendered={version:meta.version,seed:args[1].seed};return meta;};}});
  }
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const params=new URLSearchParams({v:'9',seed:'OIL-V7-RELEASE',mode:'rects',el:'18',den:'40',pal:'primary',cols:'3',grain:'0'});
 async function ready(p,version,seed='OIL-V7-RELEASE'){
  await p.waitForFunction(({version,seed})=>window.__oilRendered?.version===version&&window.__oilRendered?.seed===seed&&document.querySelector('#creatingOverlay')?.hidden===true,{version,seed},{timeout:180000});
 }
 async function openExport(p){
  if(!await p.locator('#tab-export').isVisible())await p.locator('#inspectorToggle').click();
  await p.locator('#tab-export').click();await p.locator('#exportScale').selectOption('1');
 }
 async function pixelHash(p){return p.locator('#art').evaluate(c=>{
  let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);return h>>>0;
 })}
 async function downloadedHash(p,download){
  const bytes=await readFile(await download.path());assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
  return p.evaluate(async base64=>{
   const b=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),img=await createImageBitmap(new Blob([b],{type:'image/png'}));
   const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);
   let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);img.close();return h>>>0;
  },bytes.toString('base64'));
 }
 let canonical,settings;
 for(const orientation of ['landscape','portrait']){
  const q=new URLSearchParams(params);if(orientation==='portrait')q.set('fmt','portrait');
  await page.goto(root+'?'+q,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.AlgoArt?.readSettings&&document.querySelector('#creatingOverlay')?.hidden===true);
  if(!await page.locator('#tab-composition').isVisible())await page.locator('#inspectorToggle').click();
  await page.locator('#tab-composition').click();
  await page.locator('#materialStyle').selectOption('oil');await ready(page,'oil-paint-v7');
  assert.equal(new URL(page.url()).searchParams.get('material'),'oil-v7','New oil selection uses V7');
  const hash=await pixelHash(page);await openExport(page);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#savePanel').click()]);
  assert(download.suggestedFilename().includes('-oil-paint-v7-1x.png'));
  assert.equal(await downloadedHash(page,download),hash,'Downloaded PNG matches visible oil '+orientation);
  canonical=page.url();settings=await page.evaluate(()=>window.AlgoArt.readSettings());
  const compact=await page.evaluate(()=>window.AlgoArt.socialShare.compact(location.href,Object.values(window.AlgoArt.PARAM_KEYS)));
  assert(new URL(compact).searchParams.has('c'),'Must exercise the compact token decoder');
  await page.goto(compact,{waitUntil:'domcontentloaded'});await ready(page,'oil-paint-v7');
  assert.equal(await pixelHash(page),hash,'Compact V7 link replays exact pixels '+orientation);
  const replay=await page.locator('#watchDrawing').getAttribute('href');assert.equal(new URL(replay,root).searchParams.get('material'),'oil-v7');
  results.push({orientation,hash,filename:download.suggestedFilename()});
  await page.screenshot({path:out+'/'+orientation+'.png',fullPage:false});
  console.log('PASS default V7, visible/download PNG parity and compact replay '+orientation);
 }
 for(let n=1;n<=6;n++){
  const q=new URLSearchParams(params);q.set('material','oil-v'+n);
  await page.goto(root+'?'+q,{waitUntil:'domcontentloaded'});await ready(page,'oil-paint-v'+n);
  assert.equal(new URL(page.url()).searchParams.get('material'),'oil-v'+n,'Old URL must retain revision');
  console.log('PASS explicit historical studio oil-v'+n);
 }
 // Short gallery links are used by scheduled social posts and the welcome.
 for(const [day,version] of [['2026-10-25','oil-v4'],['2026-10-26','oil-v6']]){
  const id=day+'-OP01',url=new URL(canonical);url.searchParams.set('material',version);
  const entry={id,seed:settings.seed,mode:settings.mode,material:'oil',rendererVersion:9,settings,shareUrl:url.href};
  await page.route('**/gallery/'+day+'/meta.json',route=>route.fulfill({json:{date:day,entries:[entry]}}));
  await page.goto(root+'?art='+id,{waitUntil:'domcontentloaded'});await ready(page,'oil-paint-'+version.slice(4));
  assert.equal(new URL(page.url()).searchParams.get('material'),version,'Archive restores complete oil state');
  console.log('PASS archived short link '+version);
 }
 // The final teaching frame uses the same V7 treatment as the studio.
 const replayPage=await context.newPage();replayPage.on('pageerror',e=>errors.push(e.message));
 const replayURL=new URL('about/step-by-step/',root);replayURL.search=new URL(canonical).search;
 await replayPage.goto(replayURL.href,{waitUntil:'load'});
 await replayPage.waitForFunction(()=>window.__walkthroughTest?.frames().length>2,null,{timeout:180000});
 const differences=await replayPage.evaluate(()=>{
  const A=window.AlgoArt,s=window.__walkthroughTest.settings(),c=document.createElement('canvas');
  A.renderOilPaintV7(c,s,.45,false);const final=window.__walkthroughTest.frames().at(-1),copy=document.createElement('canvas');
  copy.width=final.width;copy.height=final.height;copy.getContext('2d').drawImage(c,0,0,copy.width,copy.height);
  const a=final.getContext('2d').getImageData(0,0,copy.width,copy.height).data,b=copy.getContext('2d').getImageData(0,0,copy.width,copy.height).data;
  let differences=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])differences++;return differences;
 });assert.equal(differences,0,'Walkthrough final frame matches V7');console.log('PASS V7 walkthrough final-frame parity');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 await mobile.addInitScript(()=>{localStorage.setItem('algoart-intro-seen','1');localStorage.setItem('algoart-ethos-seen','1');localStorage.setItem('algoart-inspector-mobile','open')});
 const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));
 await mp.goto(canonical,{waitUntil:'domcontentloaded'});
 await mp.waitForFunction(()=>document.querySelector('#creatingOverlay')?.hidden===true&&document.querySelector('#materialStyle')?.value==='oil',null,{timeout:180000});
 const mobileHash=await pixelHash(mp);await openExport(mp);await mp.locator('#savePanel').click();
 await mp.locator('#pngDownload').waitFor({state:'visible',timeout:180000});
 assert((await mp.locator('#pngDownload').getAttribute('download')).includes('-oil-paint-v7-1x.png'));
 const [mobileDownload]=await Promise.all([mp.waitForEvent('download'),mp.locator('#pngDownload').click()]);
 assert.equal(await downloadedHash(mp,mobileDownload),mobileHash,'Mobile prepared PNG matches visible V7');
 await mp.locator('#tab-composition').click();
 await mp.locator('#seed').fill('OIL-V7-MOBILE-SECOND');await mp.locator('#seed').press('Tab');
 await mp.waitForFunction(previous=>{
  if(document.querySelector('#creatingOverlay')?.hidden!==true)return false;
  const c=document.querySelector('#art');let hash=2166136261;
  for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)hash=Math.imul(hash^v,16777619);
  return (hash>>>0)!==previous;
 },mobileHash,{timeout:120000});
 await openExport(mp);await mp.locator('#savePanel').click();
 await mp.locator('#pngDownload').waitFor({state:'visible',timeout:120000});
 const [secondDownload]=await Promise.all([mp.waitForEvent('download'),mp.locator('#pngDownload').click()]);
 assert.equal(await downloadedHash(mp,secondDownload),await pixelHash(mp),'Second mobile export matches changed artwork');
 console.log('PASS repeated mobile V7 prepare/download parity');
 assert.deepEqual(errors,[],'Studio/replay runtime errors');
 await writeFile(out+'/results.json',JSON.stringify(results,null,2));
 // Use the real generator and validator for tomorrow's new daily oil images.
 for(const orientation of ['landscape','portrait']){
  const run=spawnSync(process.execPath,['automation/generate-social.mjs'],{encoding:'utf8',timeout:480000,maxBuffer:8e6,
   env:{...process.env,SOCIAL_DATE:'2026-10-31',SOCIAL_MATERIAL:'oil',SOCIAL_ORIENTATION:orientation,SOCIAL_COUNT:'1',ALGOART_LOCAL_URL:root}});
  assert.equal(run.status,0,'Daily Oil V7 generation '+orientation+': '+run.stderr+' '+run.stdout.slice(-1500));
  const q=JSON.parse(await readFile('social-output/2026-10-31/oil/'+orientation+'/queue.json','utf8'));
  assert.equal(q.entries.length,1);validateOilItem(q.entries[0],'2026-10-31',orientation);
  assert.equal(new URL(q.entries[0].shareUrl).searchParams.get('material'),'oil-v7');
  console.log('PASS real daily Oil V7 '+orientation+' '+q.entries[0].seed);
 }
 console.log('PASS Oil V7 studio/export/link/archive/walkthrough/mobile/daily release checks.');
}finally{await browser.close()}

