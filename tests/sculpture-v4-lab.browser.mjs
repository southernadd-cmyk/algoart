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
  // A module-load exception should fail fast instead of appearing as a
  // two-minute page readiness timeout.
  await page.addInitScript(()=>{
    window.addEventListener('error',e=>{
      window.__sculptureLabStartupError=e.message||'JavaScript startup failure';
    });
  });
  const ready=()=>page.waitForFunction(()=>window.__sculptureLabStatus?.ready||
    window.__sculptureLabStatus?.error,undefined,{timeout:120000});
  await page.goto('http://127.0.0.1:4173/gallery/sculpture-lab/',{
    waitUntil:'domcontentloaded',timeout:45000
  });
  await ready();
  let state=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(state.ready,true,JSON.stringify({state,errors}));
  assert.equal(state.version,4);
  assert.equal(state.engine,'region-inflation-v4');
  assert.equal(await page.locator('#engineMode').inputValue(),'v4');
  assert.ok(state.reconstructedRegions>=1);
  assert.ok(state.reconstructedSourceCoverage>.08);
  assert.deepEqual(state.methods.map(m=>m.method),[
    'poisson','medial','gesture','assembly'
  ]);
  for(const m of state.methods){
    assert.ok(m.regionCount>=1,m.method+' missing source-derived regions');
    assert.ok(m.polygonTriangles>0,m.method+' missing true region mesh');
    assert.ok(m.roundedRimTriangles>0,m.method+' must have beveled contours');
    assert.equal(m.sourceInkRelief,true);
    assert.ok(Number.isFinite(m.zLayerExtent));
    assert.equal(m.localIndependentSolids,true);
    assert.ok(m.extent[2]>.012,m.method+' has no rounded 3D depth');
    assert.ok(m.sourceOverlap&&Number.isFinite(m.sourceOverlap.iou));
    assert.equal(m.noImagePlane,true);
    assert.equal(m.noSilhouetteExtrusion,true);
    assert.equal(m.preservedOriginalXY,true);
    assert.ok(m.supportAnchors>=1);
    assert.equal(m.support,'pin');
  }
  assert.ok(state.methods[0].poissonRegions>=1);
  assert.ok(state.methods[1].medialRegions>=1);
  assert.ok(state.methods[0].poissonRegions!==state.methods[1].poissonRegions);
  assert.equal(await page.locator('#colourMode option').count(),1,
    'V4 must retain original pigment only');
  for(const view of ['front','side','back','threequarter']){
    await page.locator('#'+view).click();
  }
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  await ready();
  state=await page.evaluate(()=>window.__sculptureLabStatus);
  assert.equal(state.ready,true,JSON.stringify({state,errors}));
  assert.equal(state.version,4);
  await page.locator('#settingsToggle').click();
  assert.equal(await page.locator('#engineMode').isVisible(),true);
  await page.locator('#focus').selectOption('0');
  await page.locator('#side').click();
  assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
  assert.deepEqual(shaderErrors,[],'Shader errors: '+shaderErrors.join('; '));
  console.log('V4 actual source region solids:',
    JSON.stringify(state.methods.map(m=>({
      method:m.method,regionCount:m.regionCount,medial:m.medialRegions,
      poisson:m.poissonRegions,triangles:m.polygonTriangles,
      depth:m.extent[2],iou:m.sourceOverlap?.iou
    }))));
}finally{await browser.close();}
