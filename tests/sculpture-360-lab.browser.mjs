// End-to-end Chromium proof: actual archived painting -> deterministic 3D geometry.
// No GLB input, AI inference, remote-generation API or image-plane extrusion.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({
  headless:true,
  args:['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader']
});
try{
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/gallery/sculpture-lab/',{
    waitUntil:'domcontentloaded',timeout:45000
  });
  await page.waitForFunction(()=>window.__sculptureLabStatus?.ready||
    window.__sculptureLabStatus?.error,undefined,{timeout:90000});
  let lab=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(lab.ready,true,'Sculpture room failed: '+JSON.stringify(lab));
  assert.equal(lab.engine,'rules-v1');
  assert.equal(lab.usesModel,false);
  assert.equal(lab.usesExtrusion,false);
  assert.deepEqual(lab.methods.map(m=>m.method),['petal','ribbon','pigment','hybrid']);
  assert.ok(lab.methods.every(m=>m.meshes>2&&m.polys>120));
  assert.ok(lab.methods.every(m=>m.extent.every(x=>x>.2)));
  assert.ok(!await page.locator('#aiFiles').count(),'AI upload UI must be gone');
  assert.ok(!await page.locator('#textureMode').count(),'Flat painting mode must be gone');
  assert.equal(await page.locator('#depth').inputValue(),'100');
  await page.locator('#focus').selectOption('3');
  await page.locator('#front').click();
  await page.screenshot({path:'/tmp/sculpture-lab-rules-front.png',timeout:60000});
  await page.locator('#side').click();
  await page.locator('#back').click();
  await page.locator('#orbitToggle').click();
  assert.equal(await page.locator('#orbitToggle').getAttribute('aria-pressed'),'true');
  await page.locator('#orbitToggle').click();
  assert.equal(await page.locator('#orbitToggle').getAttribute('aria-pressed'),'false');
  const prev=lab.methods[0].extent[2];
  await page.locator('#depth').fill('150');
  lab=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.ok(lab.methods[0].extent[2]>prev+0.4,'Depth slider did not grow the geometry');
  assert.equal(lab.depth,1.5);
  await page.screenshot({path:'/tmp/sculpture-lab-rules-back.png',timeout:60000});
  const paintings=await page.locator('#painting option').count();
  if(paintings>1){
    const seed=lab.seed;
    await page.locator('#painting').selectOption({index:1});
    await page.waitForFunction(old=>window.__sculptureLabStatus?.ready&&
      window.__sculptureLabStatus.seed!==old,seed,{timeout:90000});
    lab=await page.evaluate(()=>window.__sculptureLabStatus);
    assert.ok(lab.sourceMarks.length>0);
  }
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__sculptureLabStatus?.ready||
    window.__sculptureLabStatus?.error,undefined,{timeout:90000});
  lab=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(lab.ready,true,'Mobile rules room failed: '+JSON.stringify(lab));
  assert.equal(await page.locator('#depth').isVisible(),true);
  assert.equal(await page.locator('#back').isVisible(),true);
  assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
  await page.screenshot({path:'/tmp/sculpture-lab-rules-mobile.png',timeout:60000});
  console.log('Rules sculpture lab passed: ',lab.date,lab.seed,
    lab.methods.map(m=>m.method+':'+m.meshes).join(' '));
}finally{await browser.close();}
