// End-to-end proof the ISOLATED real tower uses the rebaked hybrid meshes,
// rather than simply reading production's traced contour packs.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const manifest=JSON.parse(await fs.readFile(
 'gallery/visit/test-sculpture-packs/manifest.json','utf8'));
const dates=['2026-11-10','2026-10-22'].filter(d=>manifest.dates[d]?.portraits>0);
if(dates.length!==2)throw Error('Required modern and historical tower floors missing');
const browser=await chromium.launch({headless:true,args:[
 '--disable-dev-shm-usage','--use-gl=angle',
 '--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
try {
 for(let i=0;i<dates.length;i++){
  const date=dates[i],page=await browser.newPage({
   viewport:i?{width:450,height:840}:{width:1200,height:780}
  });
  const errors=[],shaderErrors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{
   if(e.type()==='error'&&/WebGLProgram|VALIDATE_STATUS|Shader Error/i.test(e.text()))
    shaderErrors.push(e.text().slice(0,250));
  });
  await page.goto('http://127.0.0.1:4173/gallery/visit/sculpture-test-tower.html?date='+date+'&debug',
   {waitUntil:'domcontentloaded',timeout:90000});
  assert.match(await page.title(),/TEST TOWER/);
  await page.waitForFunction(d=>
   window.__phiFullEngine?.date===d||
   (document.querySelector('#error')?.hidden===false),
   date,{timeout:140000});
  const state=await page.evaluate(()=>window.__phiFullEngine);
  assert.equal(state.date,date,'Test tower selected wrong dated exhibition');
  assert.equal(state.sculptures,manifest.dates[date].portraits,
   'Room sculpture count differs from offline bake manifest');
  await page.waitForFunction(()=>document.querySelector('#enter')?.disabled===false,
   undefined,{timeout:60000});
  await page.locator('#enter').click();
  await page.waitForFunction(n=>{
    const stats=window.__PP_TEST_TOWER_SCULPTURES__;
    return !!stats && stats.loaded>=n || !!stats && stats.failed>0;
   },Math.min(2,manifest.dates[date].portraits),{timeout:170000});
  const stats=await page.evaluate(()=>{
   const o=window.__PP_TEST_TOWER_SCULPTURES__;
   return {mode:o.mode,loaded:o.loaded,failed:o.failed,
    packsLoaded:o.packsLoaded,identities:[...o.sculptures],errors:o.errors};
  });
  assert.equal(stats.mode,'isolated-hybrid-museum-pin-v1');
  assert.equal(stats.failed,0,'Rebaked hybrid failed: '+JSON.stringify(stats.errors));
  assert.ok(stats.loaded>=1,'No hybrid sculptures loaded on '+date);
  assert.ok(stats.identities.every(id=>id.startsWith(date+'/')&&
   id.endsWith(i?'mobile':'desktop')));
  assert.ok(stats.packsLoaded>=1,'Did not load offline rebake data');
  assert.equal(errors.length,0,'Browser errors: '+errors.join('; '));
  assert.equal(shaderErrors.length,0,'Three.js material error: '+shaderErrors.join('; '));
  await page.screenshot({
   path:'/tmp/test-sculpture-tower-'+date+(i?'-mobile':'-desktop')+'.png',
   timeout:100000
  });
  console.log('TEST_HYBRID_TOWER_FLOOR_OK',JSON.stringify({
   date,expected:manifest.dates[date].portraits,loaded:stats.loaded,
   quality:i?'mobile':'desktop',packsLoaded:stats.packsLoaded
  }));
  await page.close();
 }
}finally{await browser.close();}
