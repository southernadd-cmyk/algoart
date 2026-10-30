// Tests actual client-side ALGO/ART marker icon strokes, exact social
// composition share links and unchanged reader/editor settings. No posts.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const desktop=await browser.newContext({viewport:{width:1370,height:950}});
const page=await desktop.newPage();
await desktop.addInitScript(()=>localStorage.setItem('algoart-inspector-desktop','open'));
page.setDefaultTimeout(90000);
const errs=[];page.on('pageerror',err=>errs.push(err.message));
try{
 const url=new URL(base);
 url.search='?v=9&seed=SOCIAL-%CE%A6-20261015&mode=organic&fmt=portrait&el=53&den=61&cx=66&neg=49&phi=83&rec=4&spi=48&ga=93&nest=55&pen=fine&th=14&wob=43&od=3&op=70&pr=35&dry=20&curve=92&shape=59&overlap=57&rot=62&ln=1&ci=1&re=1&po=1&ar=1&pal=earth&cols=4&sat=89&bri=68&paper=%23f5f0e6&grain=13&sheet=phi&material=oil-v1';
 await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>document.querySelector('#materialStyle')?.value==='oil');
 await page.locator('#tab-export').click();
 assert.equal(await page.locator('#shareInstagram').count(),0,
  'Instagram button must be fully removed, not visually hidden');
 const first=await page.locator('#panel-export .controls').evaluate(
  el=>el.firstElementChild?.id);
 assert.equal(first,'copyLink');
 const buttons=await page.locator('.social-share-options a').evaluateAll(
  elements=>elements.map(e=>e.id));
 assert.deepEqual(buttons,['shareThreads','shareBluesky']);
 assert.match(await page.locator('.social-share-note').textContent(),
  /exact artwork link and its own image preview/);

 const art=await page.evaluate(()=>{
  const A=window.AlgoArt;
  const canvases=[...document.querySelectorAll('canvas[data-social-marker]')];
  const font=getComputedStyle(document.querySelector('#shareThreads')).fontFamily;
  const inspect=canvases.map(c=>{
    const ctx=c.getContext('2d'),p=ctx.getImageData(0,0,c.width,c.height).data;
    let opaque=0;
    for(let i=3;i<p.length;i+=4)if(p[i]>20)opaque++;
    return{kind:c.dataset.socialMarker,opaque,png:c.toDataURL()};
  });
  let calls=0;
  const orig=A.stroke,recorder=A.svgRecorder;
  A.stroke=function(){calls++;return orig.apply(this,arguments)};
  const sentinel={paths:[],precise:true};
  A.svgRecorder=sentinel;
  try{A.drawSocialMarkerIcons()}finally{
    A.stroke=orig;
    A.svgRecorder=recorder;
  }
  const redrawn=canvases.map(c=>c.toDataURL());
  const keys=Object.keys({
   seed:1,mode:1,orientation:1,elements:1,density:1,complexity:1,
   negativeSpace:1,phiStrength:1,recursion:1,spiralInfluence:1,goldenAngle:1,
   nesting:1,pen:1,thickness:1,wobble:1,overdraw:1,opacity:1,pressure:1,
   dryness:1,curveBias:1,shapeAmount:1,overlap:1,rotation:1,
   lines:1,circles:1,rectangles:1,polygons:1,arcs:1,palette:1,colourCount:1,
   saturation:1,brightness:1,paper:1,grain:1
  });
  const params={seed:'seed',mode:'mode',orientation:'fmt',
   elements:'el',density:'den',complexity:'cx',negativeSpace:'neg',
   phiStrength:'phi',recursion:'rec',spiralInfluence:'spi',
   goldenAngle:'ga',nesting:'nest',pen:'pen',thickness:'th',wobble:'wob',
   overdraw:'od',opacity:'op',pressure:'pr',dryness:'dry',curveBias:'curve',
   shapeAmount:'shape',overlap:'overlap',rotation:'rot',lines:'ln',
   circles:'ci',rectangles:'re',polygons:'po',arcs:'ar',palette:'pal',
   colourCount:'cols',saturation:'sat',brightness:'bri',paper:'paper',
   grain:'grain'};
  const paramKeys=keys.map(k=>params[k]);
  const intents=A.socialShare.intents(location.href,paramKeys);
  const token=new URL(intents.previewURL).searchParams.get('c');
  const restored=A.socialShare.expand(token,paramKeys);
  return{
   inspect,redrawn,calls,recorderPaths:sentinel.paths.length,font,
   intents,original:Object.fromEntries(new URLSearchParams(location.search)),
   restored:restored&&Object.fromEntries(restored)
  };
 });
 assert.match(art.font,/AlgoArt Marker/);
 assert.deepEqual(art.inspect.map(x=>x.kind),['threads','bluesky']);
 for(let i=0;i<2;i++){
   assert(art.inspect[i].opaque>130,'Marker-drawn logo is blank');
   assert.equal(art.inspect[i].png,art.redrawn[i],
     'Social marker logos are not deterministic');
 }
 assert(art.calls>=6,'Icons were not inked by the actual ALGO/ART marker engine');
 assert.equal(art.recorderPaths,0,
   'Toolbar ink must not alter saved SVG artwork');
 assert(art.intents.artworkURL.includes('?c='));
 assert.equal(new URL(art.intents.previewURL).host,
   'proportion-piece-social.mr-adam-clement.workers.dev');
 assert(new URL(art.intents.previewURL).pathname==='/share');
 assert([...art.intents.caption].length<300,
   'Selected artwork link is too long for Bluesky');
 assert([...art.intents.threadsCaption].length<500,
   'Versioned Threads artwork link is too long');
 assert.equal(art.intents.threadsPreviewURL,art.intents.previewURL+'&pv=4',
   'Threads must get a fresh cache key');
 assert.equal(art.intents.bluesky.includes(encodeURIComponent(art.intents.caption)),true,
   'The working Bluesky share must remain unchanged');
 // Validate the deployed live service supplies actual image-specific
 // crawler metadata and a real JPEG, not the site's generic social card.
 const card=await fetch(art.intents.threadsPreviewURL,
   {signal:AbortSignal.timeout(90000),
    headers:{'user-agent':'facebookexternalhit/1.1'}});
 assert.equal(card.status,200,'Live OG endpoint failed');
 const pageHTML=await card.text();
 assert.match(pageHTML,/property="og:image"/);
 assert.match(pageHTML,/name="twitter:image"/);
 assert(!pageHTML.includes('social-card.png'));
 assert(!/<meta\s+http-equiv=["']refresh/i.test(pageHTML),
   'A crawler-visible meta refresh would lead Threads to GitHub Pages');
 assert(pageHTML.includes('&amp;pv=4'),
   'A cached unversioned OG canonical could defeat the Threads fix');
 const imageURL=pageHTML.match(/property="og:image" content="([^"]+)"/)?.[1];
 assert(imageURL&&imageURL.includes('/share/image?c='));
 // KV only serves previews after the editor uploads the JPEG.
 // The browser upload and exact JPEG bytes are checked below; a separate
 // live Cloudflare smoke test checks actual KV write/read roundtrip.
 assert.equal(new URL(imageURL.replaceAll('&amp;','&')).pathname,'/share/image',
   'OG image must point to the Worker image route');

 for(const [key,value] of Object.entries(art.original))
   assert.equal(art.restored[key],value,'Compact link lost '+key);
 // Real canvas is captured before the social platform can scrape it.
 // Stub ONLY the network transport, preserving the actual JPEG pixels,
 // exact compact token and popup/composer navigation.
 let uploads=[];
 await desktop.route('https://proportion-piece-social.mr-adam-clement.workers.dev/share/preload?c=*',
   async route=>{
     const req=route.request(),headers={
       'access-control-allow-origin':new URL(base).origin,
       'access-control-allow-headers':'content-type',
       'access-control-allow-methods':'POST, OPTIONS'};
     if(req.method()==='OPTIONS'){
       await route.fulfill({status:204,headers});return;
     }
     const data=req.postDataJSON();
     const image=Buffer.from(data.jpeg,'base64');
     assert(image.length>15000,'Real selected Oil painting was not uploaded');
     assert.equal(image[0],255);assert.equal(image[1],216);
     uploads.push({token:new URL(req.url()).searchParams.get('c'),size:image.length});
     await route.fulfill({status:200,contentType:'application/json',
       headers,body:JSON.stringify({ok:true,bytes:image.length})});
   });
 for(const domain of ['www.threads.com','bsky.app']){
   await desktop.route('https://'+domain+'/**',route=>route.fulfill({
     status:200,contentType:'text/html',body:'<!doctype html><title>Social draft test</title>'
   }));
 }
 for(const [id,host] of [['shareThreads','www.threads.com'],
    ['shareBluesky','bsky.app']]){
   const [popup]=await Promise.all([
     page.waitForEvent('popup',{timeout:30000}),
     page.locator('#'+id).click()
   ]);
   await popup.waitForURL(u=>u.hostname===host,{timeout:30000});
   const uri=new URL(popup.url());
   assert(uri.searchParams.get('text').includes(
     id==='shareThreads'?art.intents.threadsPreviewURL:art.intents.previewURL));
   assert.match(await page.locator('#socialShareStatus').textContent(),
     /preview prepared/i);
   await popup.close();
 }
 assert.equal(uploads.length,2,'Both services must preload the actual current image');
 assert(uploads.every(x=>x.token===new URL(art.intents.artworkURL).searchParams.get('c')),
   'Preloaded image does not match the exact artwork share link');
 await page.goto(art.intents.artworkURL,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>
  document.querySelector('#seed')?.value==='SOCIAL-Φ-20261015',
  null,{timeout:90000});
 assert.equal(await page.locator('#materialStyle').inputValue(),'oil');
 assert.equal(await page.locator('#paper').inputValue(),'#f5f0e6');
 const restoredSettings=Object.fromEntries(new URL(page.url()).searchParams);
 for(const [k,value] of Object.entries(art.original))
   assert.equal(restoredSettings[k],value,'Artist link failed on '+k);

 // Mobile inspector still exposes two usable inked actions, no Instagram.
 const mobile=await browser.newContext({viewport:{width:390,height:844},
   hasTouch:true,isMobile:true});
 await mobile.addInitScript(()=>{
   localStorage.setItem('algoart-inspector-desktop','open');localStorage.setItem('algoart-inspector-mobile','closed');localStorage.setItem('algoart-intro-seen','1');
 });
 const mp=await mobile.newPage();
 await mp.goto(new URL(base).href,{waitUntil:'domcontentloaded'});
 await mp.locator('#inspectorToggle').click();
 await mp.locator('#tab-export').click();
 assert.equal(await mp.locator('#shareThreads').isVisible(),true);
 assert.equal(await mp.locator('#shareBluesky').isVisible(),true);
 assert.equal(await mp.locator('#shareInstagram').count(),0);
 await mobile.close();
 assert.deepEqual(errs,[]);
 console.log('PASS: Instagram removed; authentic deterministic A.stroke logos; Marker font; exact OG social links, Unicode seed, Bluesky limit, restored source settings and mobile layout');
}finally{await browser.close()}

