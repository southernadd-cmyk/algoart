// End-to-end V3: original painting coordinates preserved across four spatial methods.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:[
  '--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
try{
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  const errors=[],shaderErrors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{
    if(e.type()==='error'&&/WebGLProgram|shader|VALIDATE_STATUS|compile|link/i.test(e.text()))
      shaderErrors.push(e.text().slice(0,400));
  });
  await page.goto('http://127.0.0.1:4173/gallery/sculpture-lab/?engine=v3',{
    waitUntil:'domcontentloaded',timeout:45000
  });
  // A module-load exception should fail fast instead of appearing as a
  // two-minute page readiness timeout.
  await page.addInitScript(()=>{
    window.addEventListener('error',e=>{
      window.__sculptureLabStartupError=e.message||'JavaScript startup failure';
    });
  });
  const ready=()=>page.waitForFunction(()=>
    window.__sculptureLabStatus?.ready||window.__sculptureLabStatus?.error||
    window.__sculptureLabStartupError,
    undefined,{timeout:120000});
  const get=()=>page.evaluate(()=>window.__sculptureLabStatus);
  await ready();let lab=await get();
  assert.equal(lab.ready,true,JSON.stringify({lab,errors}));
  assert.equal(lab.version,3);assert.equal(lab.engine,'source-anchored-v3');
  assert.ok(lab.sourcePigmentRegions>=1);
  assert.deepEqual(lab.methods.map(m=>m.method),[
    'armature','fold','mass','hybrid']);
  assert.ok(lab.methods.every(m=>m.preservedOriginalXY));
  assert.ok(lab.methods.every(m=>m.noImagePlane&&m.noSilhouetteExtrusion));
  assert.ok(lab.methods.every(m=>m.extent[2]>.4));
  assert.ok(lab.methods.every(m=>m.sourceOverlap&&
    Number.isFinite(m.sourceOverlap.iou)&&m.sourceOverlap.iou>=0));
  assert.ok((await page.locator('#frontScore').textContent()).includes('overlap'));
  assert.ok(lab.methods.every(m=>m.front>0&&m.rear>0));
  assert.ok(lab.methods.every(m=>m.support==='pin'&&m.supportAnchors===1));
  const [armature,fold,mass,hybrid]=lab.methods;
  assert.ok(armature.rearRibCount>0&&armature.foldedSurfaceCount===0);
  assert.ok(fold.foldedSurfaceCount>0&&fold.rearRibCount===0);
  assert.ok(mass.sourceBody&&mass.rearRibCount>0);
  assert.ok(hybrid.foldedSurfaceCount>0&&hybrid.rearRibCount>0);
  assert.equal(await page.locator('#source').count(),1);
  assert.equal(await page.locator('#showGraph').isChecked(),false);
  await page.locator('#focus').selectOption('all');
  await page.locator('#front').click();
  await page.screenshot({path:'/tmp/sculpture-lab-v3-front.png',timeout:120000});
  await page.locator('#side').click();
  await page.screenshot({path:'/tmp/sculpture-lab-v3-side.png',timeout:120000});
  await page.locator('#back').click();
  await page.screenshot({path:'/tmp/sculpture-lab-v3-back.png',timeout:120000});
  await page.locator('#threequarter').click();
  await page.screenshot({path:'/tmp/sculpture-lab-v3-threequarter.png',timeout:120000});
  await page.locator('#showGraph').check();
  assert.equal(await page.locator('#showGraph').isChecked(),true);
  await page.locator('#showGraph').uncheck();
  await page.locator('#colourMode').selectOption('bronze');
  await page.waitForFunction(()=>window.__sculptureLabStatus?.ready,{
    timeout:120000
  });
  lab=await get();assert.equal(lab.methods.length,4);
  await page.locator('#colourMode').selectOption('pigment');
  await page.locator('#focus').selectOption('3');
  assert.equal(await page.locator('#focus').inputValue(),'3');
  await page.locator('#threequarter').click();
  await page.screenshot({path:'/tmp/sculpture-lab-v3-hybrid.png',timeout:120000});
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  await ready();lab=await get();
  assert.equal(lab.ready,true,'Mobile failed: '+JSON.stringify(lab));
  assert.equal(lab.version,3);
  assert.equal(await page.locator('#settingsToggle').isVisible(),true);
  assert.equal(await page.locator('#controlsPanel').isVisible(),false);
  await page.locator('#settingsToggle').click();
  assert.equal(await page.locator('#controlsPanel').isVisible(),true);
  assert.equal(await page.locator('#depth').isVisible(),true);
  await page.locator('#focus').selectOption('0');
  await page.locator('#side').click();
  await page.screenshot({path:'/tmp/sculpture-lab-v3-mobile-side.png',timeout:120000});
  assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
  assert.deepEqual(shaderErrors,[],'Shader errors: '+shaderErrors.join('; '));
  console.log('Source-anchored V3 sculpture:',
    lab.methods.map(m=>m.method+':'+m.meshCount+' / '+
      Math.round((m.sourceOverlap?.iou||0)*100)+'% IoU').join(', '));
}finally{await browser.close();}
