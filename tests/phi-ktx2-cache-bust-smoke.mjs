// Verify the user-facing texture-cold benchmark sends three genuinely unique
// architectural texture requests per mode, without touching live assets.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base='https://southernadd-cmyk.github.io/algoart/test/virtual-gallery/';
const names=['Bricks055_NormalGL','Bricks055_Roughness','OfficeCeiling001_NormalGL'];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const comparison=await browser.newPage();
 const pageErrors=[];
 comparison.on('pageerror',error=>pageErrors.push(String(error)));
 await comparison.goto(base+'ktx2-comparison.html',{waitUntil:'load',timeout:60000});
 assert.equal(await comparison.locator('#coldRun').count(),1,'Cold-texture benchmark button exists');
 assert.equal(await comparison.locator('#run').count(),1,'Normal benchmark remains');
 const text=await comparison.locator('body').innerText();
 assert.ok(text.includes('No DevTools setting is required'),'Page explains automated texture cache-busting');
 await comparison.close();

 for(const mode of ['jpeg','multi']){
  const page=await browser.newPage({viewport:{width:1050,height:680}});
  const seed='smoke-'+mode+'-fresh-assets-20261031';
  const reqs=[];
  page.on('request',request=>{
    const url=new URL(request.url());
    if(names.some(name=>url.pathname.endsWith(name+(mode==='jpeg'?'.jpg':'.ktx2'))))
      reqs.push({name:url.pathname.split('/').at(-1),seed:url.searchParams.get('ktxCold')});
  });
  const url=new URL(base+'full-engine.html');
  url.searchParams.set('debug','1');
  url.searchParams.set('coldbench','1');
  url.searchParams.set('coldseed',seed);
  if(mode==='multi')url.searchParams.set('ktx2','multi');
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(
   mode=>mode==='multi'
    ?window.__phiKTX2Pilot?.status==='loaded'||window.__phiKTX2Pilot?.status==='partial-fallback'
    :['off'].includes(window.__phiKTX2Pilot?.status)&&
      performance.getEntriesByType('resource').some(r=>r.name.includes('Bricks055_NormalGL.jpg')),
    mode,{timeout:100000});
  await page.waitForFunction(
    ({names,mode,seed})=>names.every(name=>performance.getEntriesByType('resource').some(
     r=>r.name.includes(name+(mode==='jpeg'?'.jpg':'.ktx2'))&&r.name.includes('ktxCold='+seed)
    )),
    {names,mode,seed},{timeout:50000});
  const found=names.map(n=>reqs.find(r=>r.name===n+(mode==='jpeg'?'.jpg':'.ktx2')));
  assert.ok(found.every(x=>x&&x.seed===seed),'Every '+mode+' map must use the unique cold seed');
  if(mode==='multi'){
   assert.equal(await page.evaluate(()=>window.__phiKTX2Pilot.compressedCount),3,'All three KTX maps remain compressed');
  }
  console.log('TEXTURE_COLD_SMOKE '+JSON.stringify({mode,seed,maps:found,passed:true}));
  await page.close();
 }
 assert.deepEqual(pageErrors,[]);
 console.log('TEXTURE_COLD_SMOKE_PASS');
}finally{await browser.close();}
