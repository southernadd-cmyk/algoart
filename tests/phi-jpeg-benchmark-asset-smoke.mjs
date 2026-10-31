// One real, cache-busted test-tower visit. Validate that the network requests
// carry the requested cold identity, all paintings load, and no KTX2 fallback
// occurs. This is NOT an FPS benchmark (CI uses software WebGL).
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const seed='cold-ci-20261031-a';
const gallery='https://southernadd-cmyk.github.io/algoart/test/virtual-gallery/full-engine.html';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
try{
 const page=await browser.newPage({viewport:{width:1100,height:720},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(gallery+'?debug=1&liftprofile=1&jpegformat=lossless&coldbench=1&benchcache=cold&benchseed='+seed,
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled||!!window.__galleryStartupError,
  null,{timeout:105000});
 assert.equal(await page.evaluate(()=>window.__galleryStartupError||''),'');
 const cache=await page.evaluate(()=>window.__phiJPEGCacheBench?.metadata());
 assert.equal(cache?.mode,'cold');
 assert.equal(cache?.seed,seed);
 await page.locator('#enter').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden===true,null,{timeout:20000});
 await page.locator('#openLift').evaluate(el=>el.click());
 await page.waitForFunction(()=>!document.querySelector('#lift')?.hidden,null,{timeout:12000});
 await page.locator('#liftDays button.lift-available:not(.lift-current)').first().evaluate(el=>el.click());
 await page.waitForFunction(()=>window.__phiLiftState?.floor>0&&!window.__phiLiftState?.travelling,
  null,{timeout:125000});
 const completed=await page.waitForFunction(()=>{
  const info=window.__phiFullEngine;
  return info?.paintings>0&&info.paintingsLoaded===info.paintings;
 },null,{timeout:65000}).then(()=>true,()=>false);
 const audit=await page.evaluate(()=>{
  const info=window.__phiFullEngine||{},stats=window.__phiArtworkPreload?.()||{};
  const bank=window.__phiJPEGLossless||{},resources=performance.getEntriesByType('resource');
  return {paintings:info.paintings,paintingsLoaded:info.paintingsLoaded,
   preload:stats,bank:{requested:bank.requested,loaded:bank.loaded,failed:bank.failed,
   artworks:bank.artworks,failures:bank.failures?.slice(0,8)},
   lift:window.__phiLiftPreparation||null,
   liftProfile:window.__phiLiftProfile?.visits?.at(-1)||null,
   deferredQueue:window.__phiDeferredGallery?.()||null,
   stage:window.__galleryStage||'',
   errors:window.__phiLiftError||null,
   jpgResources:resources.filter(x=>/\\.(jpg|ktx2)(\\?|$)/.test(x.name)).length,
   taggedAssets:resources.filter(x=>x.name.includes('phiBenchAsset=')).length};
 });
 console.log('COLD_BENCH_LOADING_DIAGNOSTICS '+JSON.stringify({completed,audit,errors}));
 assert.ok(completed,'All wall paintings must finish; diagnostics above show the bottleneck');
 const result=await page.evaluate(seed=>{
  const entries=performance.getEntriesByType('resource');
  const matched=entries.filter(entry=>{
   try{
    const url=new URL(entry.name);
    return /\.(jpg|jpeg|ktx2)$/i.test(url.pathname)&&url.searchParams.get('phiBenchAsset')===seed;
   }catch{return false}
  });
  const textures=window.__phiJPEGLossless||{};
  return {floor:window.__phiLiftState.floor,paintings:window.__phiFullEngine.paintings,
   paintingsLoaded:window.__phiFullEngine.paintingsLoaded,cache:window.__phiJPEGCacheBench?.metadata(),
   matched:matched.length,unique:new Set(matched.map(x=>x.name)).size,
   transferred:matched.filter(x=>x.transferSize>0).length,
   cached:matched.filter(x=>x.transferSize===0).length,
   bytes:matched.reduce((s,x)=>s+x.transferSize,0),fallback:textures.failed,
   artworks:textures.artworks,architecture:textures.architectural,
   liftProfile:window.__phiLiftProfile?.visits?.at(-1)||null,
   mirror:matched.some(x=>x.name.includes('/ktx2-lossless/external-jpeg/'))};
 },seed);
 console.log('COLD_BENCH_REAL_GALLERY '+JSON.stringify(result));
 assert.ok(result.paintings>0&&result.paintingsLoaded===result.paintings);
 assert.ok(result.liftProfile?.stages.some(x=>x.name==='warmup-details'),'Lift warmup profiling must record shader/GPU stages');
 assert.ok(result.matched>=10,'At least ten cold tagged texture requests');
 assert.ok(result.unique>=10);
 assert.ok(result.transferred>=8,'Cold image requests must actually transfer bytes');
 assert.equal(result.fallback,0);
 assert.ok(result.artworks>=result.paintings);
 assert.deepEqual(errors,[]);
 console.log('COLD_BENCH_REAL_GALLERY_PASS');
}finally{await browser.close()}
