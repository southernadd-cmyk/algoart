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
  assert.equal(lab.engine,'jscad-csg-v1');
  assert.equal(lab.usesJSCAD,true);
  assert.equal(lab.usesModel,false);
  assert.equal(lab.usesExtrusion,false);
  assert.deepEqual(lab.methods.map(m=>m.method),['petal','ribbon','pigment','hybrid']);
  assert.ok(lab.methods.every(m=>m.meshes>=1&&m.polys>120));
  assert.ok(lab.methods.every(m=>m.csgPolygons>20));
  assert.equal(lab.resemblance,.85);
  assert.ok(lab.methods.every(m=>m.sourceTraceCount>0),'No source-following 3D marks');
  assert.equal(lab.sourceMode,'original');
  assert.ok(lab.sourceEvidence.originalPaths>5,
    'The original V10 marker generator must supply real recorded source paths: '+
    JSON.stringify(lab.sourceEvidence));
  assert.ok(['original-engine-recorded','archived-pigment-contours','sampled-pixels-fallback']
    .includes(lab.methods[0].sourceOrigin));
  if(lab.sourceEvidence.material!=='marker')
    assert.ok(lab.sourceEvidence.archivedMaterialContours>0,
      'Material-specific contours must come from archived final paint');
  assert.equal(lab.sourceEvidence.error,null,
    'Source recorder failed: '+lab.sourceEvidence.error);
  assert.ok(lab.methods.some(m=>m.subtractApplied),'CSG should carve actual negative space');
  assert.ok(lab.methods.every(m=>m.extent.every(x=>x>.2)));
  assert.ok(!await page.locator('#aiFiles').count(),'AI upload UI must be gone');
  assert.ok(!await page.locator('#textureMode').count(),'Flat painting mode must be gone');
  assert.equal(await page.locator('#depth').inputValue(),'100');
  // Compare the direct renderer recording against the old inferred source.
  await page.locator('#sourceMode').selectOption('raster');
  let inferred=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(inferred.sourceMode,'raster');
  assert.ok(inferred.methods.every(m=>m.sourceOrigin==='sampled-pixels-fallback'));
  assert.ok(inferred.methods.every(m=>m.sourceDetailAnchors.every(a=>
    inferred.sourceMarks.some(s=>s.x===a.x&&s.y===a.y))));
  await page.locator('#sourceMode').selectOption('original');
  lab=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(lab.sourceMode,'original');
  await page.locator('#geometryMode').selectOption('rules');
  let baseline=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(baseline.engine,'rules-v1');
  assert.ok(baseline.methods.every(m=>m.meshes>=2));
  await page.locator('#geometryMode').selectOption('jscad');
  lab=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(lab.engine,'jscad-csg-v1');
  const originalTraces=lab.methods[0].sourceTraceCount;
  await page.locator('#resemblance').fill('10');
  let reduced=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(reduced.resemblance,.10);
  assert.ok(reduced.methods[0].sourceTraceCount<=originalTraces);
  await page.locator('#resemblance').fill('85');
  lab=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(lab.methods[0].sourceTraceCount,originalTraces);
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
  // Verify that a marker portrait preserves *actual* cubic/dashed SVG paths.
  const markerFile=await page.locator('#painting option').evaluateAll(options=>
    options.find(o=>o.value.includes('-marker-'))?.value||'');
  if(!markerFile)throw Error('Need a marker portrait to verify direct vector fidelity');
  await page.locator('#painting').selectOption(markerFile);
  await page.waitForFunction(file=>window.__sculptureLabStatus?.ready&&
    window.__sculptureLabStatus.imageFile===file,markerFile,{timeout:90000});
  lab=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(lab.sourceEvidence.material,'marker');
  assert.ok(lab.sourceEvidence.originalPaths>10);
  assert.ok(lab.sourceEvidence.visiblePaths>0,'No original marker-engine SVG stroke was translated');
  assert.ok(lab.methods.every(m=>m.sourceOrigin==='original-engine-recorded'));
  assert.ok(lab.methods.every(m=>m.originalPointCount>0));
  assert.ok(lab.methods.every(m=>m.fineLinePaths>0),
    'Fine original source marks must not be discarded by the 3D tube budget');
  await page.locator('#focus').selectOption('0');
  await page.locator('#front').click();
  await page.screenshot({path:'/tmp/sculpture-lab-original-marker-front.png',timeout:60000});
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__sculptureLabStatus?.ready||
    window.__sculptureLabStatus?.error,undefined,{timeout:90000});
  lab=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(lab.ready,true,'Mobile CSG room failed: '+JSON.stringify(lab));
  assert.equal(lab.engine,'jscad-csg-v1');
  assert.equal(await page.locator('#settingsToggle').isVisible(),true);
  assert.equal(await page.locator('#depth').isVisible(),false);
  await page.screenshot({path:'/tmp/sculpture-lab-rules-mobile.png',timeout:60000});
  await page.locator('#settingsToggle').click();
  assert.equal(await page.locator('#settingsToggle').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#depth').isVisible(),true);
  assert.equal(await page.locator('#geometryMode').isVisible(),true);
  assert.equal(await page.locator('#sourceMode').isVisible(),true);
  assert.ok(lab.sourceEvidence.originalPaths>0,'Mobile archive source capture failed');
  assert.equal(await page.locator('#resemblance').isVisible(),true);
  assert.equal(await page.locator('#back').isVisible(),true);
  assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
  await page.screenshot({path:'/tmp/sculpture-lab-settings-mobile.png',timeout:60000});
  console.log('JSCAD CSG sculpture lab passed: ',lab.date,lab.seed,
    lab.methods.map(m=>m.method+':'+m.meshes).join(' '));
}finally{await browser.close();}
