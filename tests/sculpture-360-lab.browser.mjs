// End-to-end acceptance: this is a 3D-first lab, not the old extrusion demo.
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
  await page.goto('http://127.0.0.1:4173/gallery/sculpture-lab/',{
    waitUntil:'domcontentloaded',timeout:45000
  });
  const ready=()=>page.waitForFunction(()=>
    window.__sculptureLabStatus?.ready||window.__sculptureLabStatus?.error,
    undefined,{timeout:120000});
  const get=()=>page.evaluate(()=>window.__sculptureLabStatus);
  await ready();let lab=await get();
  assert.equal(lab.ready,true,JSON.stringify(lab));
  assert.equal(lab.version,2);assert.equal(lab.engine,'spatial-v2');
  assert.ok(lab.graphNodes>=4&&lab.graphGestures>=3);
  assert.deepEqual(lab.methods.map(m=>m.method),[
    'strand','ribbon','mass','hybrid']);
  assert.ok(lab.methods.every(m=>m.noImagePlane&&m.noSilhouetteExtrusion));
  assert.ok(lab.methods.every(m=>m.extent[2]>.4));
  assert.ok(lab.methods.every(m=>m.front>0&&m.rear>0));
  assert.ok(lab.methods.every(m=>m.support==='pin'&&m.supportAnchors===1));
  assert.ok(new Set(lab.methods.map(m=>m.meshCount)).size>=3);
  assert.equal(await page.locator('#source').count(),1);
  assert.equal(await page.locator('#showGraph').isChecked(),false);
  await page.locator('#focus').selectOption('all');
  await page.locator('#front').click();
  await page.screenshot({path:'/tmp/sculpture-lab-v2-front.png',timeout:120000});
  await page.locator('#side').click();
  await page.screenshot({path:'/tmp/sculpture-lab-v2-side.png',timeout:120000});
  await page.locator('#back').click();
  await page.screenshot({path:'/tmp/sculpture-lab-v2-back.png',timeout:120000});
  await page.locator('#threequarter').click();
  await page.screenshot({path:'/tmp/sculpture-lab-v2-threequarter.png',timeout:120000});
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
  await page.screenshot({path:'/tmp/sculpture-lab-v2-hybrid.png',timeout:120000});
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  await ready();lab=await get();
  assert.equal(lab.ready,true,'Mobile failed: '+JSON.stringify(lab));
  assert.equal(lab.version,2);
  assert.equal(await page.locator('#settingsToggle').isVisible(),true);
  assert.equal(await page.locator('#controlsPanel').isVisible(),false);
  await page.locator('#settingsToggle').click();
  assert.equal(await page.locator('#controlsPanel').isVisible(),true);
  assert.equal(await page.locator('#depth').isVisible(),true);
  await page.locator('#focus').selectOption('0');
  await page.locator('#side').click();
  await page.screenshot({path:'/tmp/sculpture-lab-v2-mobile-side.png',timeout:120000});
  assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
  assert.deepEqual(shaderErrors,[],'Shader errors: '+shaderErrors.join('; '));
  console.log('Genuine XYZ sculpture comparison:',lab.graphNodes,
    lab.graphGestures,lab.methods.map(m=>m.method+':'+m.meshCount).join(', '));
}finally{await browser.close();}
