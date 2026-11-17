// Visual sample gate: new, locally baked geometry in the existing lab renderer.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {sculpturePreset} from '../gallery/sculpture-v2-test/sculpture-presets.mjs';
import {LAB_URL,routeLabCheckout} from './sculpture-lab-browser-checkout.mjs';
const out=process.env.V2_BAKE_OUT||'artifacts/sculpture-v2-packs';
const report=JSON.parse(await fs.readFile(path.join(out,'bake-report.json'),'utf8'));
const day=report.days.find(d=>d.eligible)?.date;
assert.ok(day,'No sample floor');
const metaBytes=await fs.readFile('gallery/'+day+'/meta.json');
const meta=JSON.parse(metaBytes);
const portraits=meta.entries.filter(e=>e.orientation==='portrait'&&e.material!=='confluence');
const worker='https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev';
const sha=b=>createHash('sha256').update(b).digest('hex');
const assets=new Map(),qualities={};
for(const quality of ['desktop','mobile']){
 const bytes=await fs.readFile(path.join(out,day,'3d/v2/sculptures.'+quality+'.json.gz'));
 const checksum=sha(bytes);
 const url=worker+'/sculptures-v2/daily/v4.2.1/'+day+'/'+quality+'/'+checksum+'.json.gz';
 assets.set(url,bytes);qualities[quality]={url,sha256:checksum,bytes:bytes.length};
}
const manifest={schema:'pp-sculpture-v2-daily-r2-manifest',version:1,
 revision:'v4.2.1-v2-pigment-island-fix',date:day,worker,ready:true,
 confluenceExcluded:true,portraits:portraits.length,metaSha256:sha(metaBytes),qualities};
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage',
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await routeLabCheckout(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(sculpturePreset().id==='legacy')await page.route(worker+'/**',route=>{
  const url=route.request().url(),bytes=assets.get(url);
  const headers={'access-control-allow-origin':'https://southernadd-cmyk.github.io'};
  if(bytes)return route.fulfill({body:bytes,contentType:'application/gzip',headers});
  if(url===worker+'/sculptures-v2/daily/v4.2.1/'+day+'/manifest.json')
   return route.fulfill({json:manifest,headers});
  return route.abort();
 });
 for(const [i,entry] of portraits.entries()){
  if(i===0)await page.goto(LAB_URL+'?date='+day+'&image='+entry.imageFile,{waitUntil:'domcontentloaded'});
  else await page.locator('#painting').selectOption(entry.imageFile);
  await page.waitForFunction(()=>window.__sculptureLabStatus?.ready||window.__sculptureLabStatus?.error,
   undefined,{timeout:120000});
  const state=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(state.ready,true,JSON.stringify(state));
  assert.equal(state.imageFile,entry.imageFile);
  assert.equal(state.methods[0].sourceCoverage,1);
  await page.locator('#thumb').evaluate(img=>img.decode());
  await page.locator('#threequarter').click();
  await page.screenshot({path:'/tmp/sculpture-preset-'+entry.material+'-'+i+'.png'});
 }
 await page.setViewportSize({width:390,height:844});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sculptureLabStatus?.ready,undefined,{timeout:120000});
 await page.locator('#thumb').evaluate(img=>img.decode());
 await page.screenshot({path:'/tmp/sculpture-preset-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('PRESET_PREVIEW_OK',day,portraits.length,'original source paintings, desktop/mobile');
}finally{await browser.close();}
