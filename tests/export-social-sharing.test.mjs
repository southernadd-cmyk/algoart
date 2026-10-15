// Browser checks for real Export sharing actions. No social API calls/posts.
// Verify exact source parameters, intentional platform limitations and
// Instagram's real native-PNG fallback rather than a fake upload link.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1370,height:990},acceptDownloads:true});
await context.route('https://www.instagram.com/**',route=>route.fulfill({
 status:200,contentType:'text/html',body:'<!doctype html><title>Instagram (test stub)</title>'
}));
const page=await context.newPage();
page.setDefaultTimeout(70000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('algoart-intro-seen','1'));
try{
 const start=new URL(base);
 start.search='?v=9&seed=SOCIAL-SHARE-%CE%A6%7E221&mode=organic&fmt=portrait&el=53&den=61&cx=66&neg=49&phi=83&rec=4&spi=48&ga=93&nest=55&pen=fine&th=14&wob=43&od=3&op=70&pr=35&dry=20&curve=92&shape=59&overlap=57&rot=62&ln=1&ci=1&re=1&po=1&ar=1&pal=earth&cols=4&sat=89&bri=68&paper=%23f5f0e6&grain=13&sheet=phi&material=oil-v1';
 await page.goto(start.href,{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(()=>document.querySelector('#materialStyle')?.value==='oil');
 await page.locator('#tab-export').click();
 const layout=await page.evaluate(()=>{
   const ids=[...document.querySelector('#panel-export .controls').children].map(x=>x.id);
   const buttons=[...document.querySelectorAll('.social-share-options a,.social-share-options button')].map(x=>x.id);
   return{ids,buttons,heading:document.querySelector('#socialShareHeading')?.textContent};
 });
 assert.equal(layout.ids[0],'copyLink','Copy Artwork Link must come first');
 assert.deepEqual(layout.buttons,['shareInstagram','shareThreads','shareBluesky']);
 assert.match(layout.heading,/SHARE TO SOCIALS/);
 const data=await page.evaluate(()=>{
   const A=window.AlgoArt,s=A.readSettings();
   const names=['v','seed','mode','fmt','el','den','cx','neg','phi','rec','spi',
    'ga','nest','pen','th','wob','od','op','pr','dry','curve','shape','overlap','rot',
    'ln','ci','re','po','ar','pal','cols','sat','bri','paper','grain',
    'sheet','material','fit','tissue','watercolor'];
   const params=new URLSearchParams(location.search);
   const links=A.socialShare.intents(location.href,names.slice(1,35));
   const expected=A.socialShare.expand(new URL(links.artworkURL).searchParams.get('c'),names.slice(1,35));
   return{full:location.href,links,src:Object.fromEntries(params),
     round:expected&&Object.fromEntries(expected),
     length:[...links.caption].length,
     seed:s.seed,material:document.querySelector('#materialStyle').value,
     pngSize:document.querySelector('#exportScale').value};
 });
 assert.equal(data.seed,'SOCIAL-SHARE-Φ~221');
 assert.equal(data.material,'oil');
 assert(data.links.artworkURL.includes('?c='),'Share link not compact');
 assert(data.length<300,'Bluesky share composer would exceed 300 characters');
 for(const [key,val] of Object.entries(data.src))assert.equal(data.round[key],val,
   'Compact share cannot reconstruct '+key);
 const q=new URL(data.links.artworkURL);
 assert.equal(q.pathname,new URL(data.full).pathname);
 for(const [id,domain,param] of [
  ['shareThreads','www.threads.com','text'],
  ['shareBluesky','bsky.app','text']]){
   await page.locator('#'+id).evaluate(el=>el.addEventListener('click',e=>e.preventDefault()));
   await page.locator('#'+id).click();
   const href=await page.locator('#'+id).getAttribute('href');
   const u=new URL(href);
   assert.equal(u.hostname,domain);
   assert(u.pathname.includes('intent/'),'Share URL does not open a composer');
   assert(u.searchParams.get(param).includes(data.links.artworkURL));
 }
 await page.goto(data.links.artworkURL,{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(()=>document.querySelector('#seed')?.value==='SOCIAL-SHARE-Φ~221');
 const recovered=await page.evaluate(()=>({
   params:Object.fromEntries(new URLSearchParams(location.search)),
   material:document.querySelector('#materialStyle').value,
   paper:document.querySelector('#paper').value,
   version:window.AlgoArt.rendererVersion
 }));
 assert.equal(recovered.material,'oil');
 assert.equal(recovered.version,9);
 for(const [key,val] of Object.entries(data.src))assert.equal(recovered.params[key],val,
  'Shared URL did not restore original state '+key);

 await page.locator('#tab-export').click();
 const [popup,download]=await Promise.all([
   page.waitForEvent('popup',{timeout:60000}),
   page.waitForEvent('download',{timeout:60000}),
   page.locator('#shareInstagram').click()
 ]).then(([p,d])=>[p,d]);
 assert.equal(new URL(popup.url()).hostname,'www.instagram.com');
 assert.match(download.suggestedFilename(),/oil-paint-v1-1x\.png$/);
 assert.match(await page.locator('#socialShareStatus').textContent(),
  /PNG downloaded|Open Instagram/);
 await popup.close();

 // Phone share sheet: native transfer of actual generated PNG to app
 // without claiming that Instagram auto-posted the content.
 const mobile=await browser.newContext({viewport:{width:390,height:844},
   isMobile:true,hasTouch:true,acceptDownloads:true});
 await mobile.addInitScript(()=>{
   localStorage.setItem('algoart-intro-seen','1');
   window.__sharedFiles=[];
   Object.defineProperty(navigator,'canShare',{configurable:true,
     value:data=>!!data.files?.length});
   Object.defineProperty(navigator,'share',{configurable:true,
     value:data=>{window.__sharedFiles.push({
       count:data.files.length,size:data.files[0].size,
       name:data.files[0].name,text:data.text
     });return Promise.resolve()}});
 });
 const mobilePage=await mobile.newPage();
 const mo=new URL(base);mo.search='?v=9&seed=MOBILE-SHARE-TEST&mode=spiral&material=watercolour-v2s';
 await mobilePage.goto(mo.href,{waitUntil:'domcontentloaded',timeout:70000});
 // Mobile inspector defaults to collapsed. Open it as a real user would.
 await mobilePage.locator('#inspectorToggle').click();
 await mobilePage.locator('#tab-export').click();
 await mobilePage.locator('#shareInstagram').click();
 await mobilePage.waitForFunction(()=>window.__sharedFiles.length>0,null,{timeout:90000});
 const transfer=await mobilePage.evaluate(()=>window.__sharedFiles[0]);
 assert.match(transfer.name,/watercolour-v2s.*1x\.png$/);
 assert(transfer.size>20000,'No actual image was shared');
 assert(transfer.text.includes('algoart'));
 await mobile.close();
 assert.deepEqual(errors,[],'Browser errors');
 console.log('PASS Export sharing: Copy Link first, exact compact URL with Unicode, genuine Threads/Bluesky intents, desktop Instagram PNG+website, mobile native PNG share',JSON.stringify({
  fullLength:data.full.length,compactLength:data.links.artworkURL.length,
  blueskyCaptionLength:data.length,desktopPNG:download.suggestedFilename(),
  mobileFileBytes:transfer.size}));
}finally{await browser.close()}
