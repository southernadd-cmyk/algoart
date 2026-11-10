// Browser regression: archived artwork is the material ON the actual 360°
// sculpture, not a drawing over a different pale solid behind it.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({
  headless:true,
  args:['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader']
});
try {
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  const errors=[],shaderErrors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{
    if(e.type()==='error'&&/WebGLProgram|shader|VALIDATE_STATUS|compile|link/i.test(e.text()))
      shaderErrors.push(e.text().slice(0,300));
  });
  await page.goto('http://127.0.0.1:4173/gallery/sculpture-lab/',{
    waitUntil:'domcontentloaded',timeout:45000
  });
  const ready=()=>page.waitForFunction(()=>window.__sculptureLabStatus?.ready||
    window.__sculptureLabStatus?.error,undefined,{timeout:100000});
  const report=()=>page.evaluate(()=>window.__sculptureLabStatus);
  await ready();
  let lab=await report();
  assert.equal(lab.ready,true,JSON.stringify(lab));
  assert.equal(lab.engine,'paint-surface-v1');
  assert.equal(lab.usesActualPaintTexture,true);
  assert.equal(lab.usesModel,false);
  assert.equal(lab.separatePaintingOverlay,false);
  assert.equal(lab.usesJSCAD,false);
  assert.deepEqual(lab.methods.map(m=>m.method),['petal','ribbon','pigment','hybrid']);
  assert.ok(lab.methods.every(m=>m.meshes===1),
    'A detached image/line layer or unrelated back sculpture is still visible');
  assert.ok(lab.methods.every(m=>m.sideTextureOnBody===true),
    'The curved sides have no actual pigment continuation texture');
  assert.ok(lab.methods.every(m=>m.sourceTextureOnBody===true),
    'Archived source painting is not physically mapped on the 3D object');
  assert.ok(lab.methods.every(m=>m.paintedCells>30&&m.frontIndices>0&&
    m.backIndices>0&&m.wallIndices>0));
  assert.ok(lab.methods.every(m=>m.extent[2]>.4),
    'Sculpture is not a real front/side/back volume');
  assert.ok(lab.methods.every(m=>m.separatePaintingOverlay===false));
  assert.equal(await page.locator('#geometryMode').inputValue(),'surface');
  assert.equal(await page.locator('#sourceMode').isDisabled(),true);
  assert.equal(await page.locator('#resemblance').isDisabled(),true);
  assert.ok(!await page.locator('#aiFiles').count());

  // Paint texture and bump must be the source image, irrespective of 3D method.
  // Original source canvas is expected to survive mixed oil/tissue materials.
  const oilOption=await page.locator('#painting option').evaluateAll(options=>
    options.find(o=>/oil/i.test(o.value+' '+o.textContent))?.value||'');
  const tissueOption=await page.locator('#painting option').evaluateAll(options=>
    options.find(o=>/tissue/i.test(o.value+' '+o.textContent))?.value||'');
  for (const [name,option] of [['oil',oilOption],['tissue',tissueOption]]) {
    if(!option)continue;
    await page.locator('#painting').selectOption(option);
    await page.waitForFunction(file=>
      window.__sculptureLabStatus?.ready&&window.__sculptureLabStatus.imageFile===file,
      option,{timeout:100000});
    lab=await report();
    assert.equal(lab.engine,'paint-surface-v1');
    assert.ok(lab.methods.every(m=>m.meshes===1&&m.sourceTextureOnBody&&m.sideTextureOnBody));
    assert.equal(lab.paintingFinish,name);
    await page.locator('#focus').selectOption('3');
    await page.locator('#front').click();
    await page.screenshot({path:'/tmp/sculpture-lab-material-'+name+'-front.png',
      timeout:120000});
    await page.locator('#side').click();
    await page.screenshot({path:'/tmp/sculpture-lab-material-'+name+'-side.png',
      timeout:120000});
  }

  const originalDepth=lab.methods[0].extent[2];
  await page.locator('#depth').fill('150');
  lab=await report();
  assert.equal(lab.depth,1.5);
  assert.ok(lab.methods[0].extent[2]>originalDepth+.25,
    'Depth change moved an overlay rather than shaping the painted body');
  await page.locator('#depth').fill('100');

  // Keep older modelling experiments explicitly available, never on top of
  // the source painting by default.
  await page.locator('#geometryMode').selectOption('jscad');
  lab=await report();
  assert.equal(lab.engine,'jscad-csg-v1');
  assert.equal(lab.usesJSCAD,true);
  assert.equal(await page.locator('#sourceMode').isDisabled(),false);
  assert.equal(await page.locator('#resemblance').isDisabled(),false);
  assert.ok(lab.methods.every(m=>m.csgPolygons>20));
  assert.ok(lab.methods.some(m=>m.subtractApplied));
  await page.locator('#sourceMode').selectOption('raster');
  lab=await report();
  assert.equal(lab.sourceMode,'raster');
  assert.ok(lab.methods.every(m=>m.sourceOrigin==='sampled-pixels-fallback'));
  await page.locator('#sourceMode').selectOption('original');
  await page.locator('#geometryMode').selectOption('rules');
  lab=await report();
  assert.equal(lab.engine,'rules-v1');
  await page.locator('#geometryMode').selectOption('surface');
  lab=await report();
  assert.equal(lab.engine,'paint-surface-v1');
  assert.ok(lab.methods.every(m=>m.meshes===1&&m.sourceTextureOnBody));

  // Original source capture remains functional for the optional JSCAD study.
  const markerFile=await page.locator('#painting option').evaluateAll(options=>
    options.find(o=>o.value.includes('-marker-'))?.value||'');
  if(markerFile){
    await page.locator('#painting').selectOption(markerFile);
    await page.waitForFunction(file=>
      window.__sculptureLabStatus?.ready&&window.__sculptureLabStatus.imageFile===file,
      markerFile,{timeout:100000});
    lab=await report();
    assert.equal(lab.sourceEvidence.material,'marker');
    assert.ok(lab.sourceEvidence.originalPaths>0,
      'Original renderer path capture stopped working');
    assert.equal(lab.engine,'paint-surface-v1');
  }

  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  await ready();
  lab=await report();
  assert.equal(lab.ready,true,'Mobile material sculpture failed: '+JSON.stringify(lab));
  assert.equal(lab.engine,'paint-surface-v1');
  assert.ok(lab.methods.every(m=>m.meshes===1&&m.sourceTextureOnBody));
  assert.equal(await page.locator('#settingsToggle').isVisible(),true);
  assert.equal(await page.locator('#depth').isVisible(),false);
  await page.locator('#focus').selectOption('3');
  await page.locator('#front').click();
  await page.screenshot({path:'/tmp/sculpture-lab-material-mobile-front.png',
    timeout:120000});
  await page.locator('#side').click();
  await page.screenshot({path:'/tmp/sculpture-lab-material-mobile-side.png',
    timeout:120000});
  await page.locator('#settingsToggle').click();
  assert.equal(await page.locator('#depth').isVisible(),true);
  assert.equal(await page.locator('#geometryMode').isVisible(),true);
  assert.equal(await page.locator('#back').isVisible(),true);
  assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
  assert.deepEqual(shaderErrors,[],'WebGL shader errors: '+shaderErrors.join('; '));
  console.log('Source image mapped to one real volumetric mesh per method:',
    lab.paintingFinish,lab.methods.map(m=>m.method+':'+m.meshes).join(' '));
}finally{await browser.close();}
