import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
await mkdir('phi-tower-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const options of [{viewport:{width:1200,height:800},deviceScaleFactor:1},{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}]){
  const context=await browser.newContext(options),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),type:r.resourceType()}));
  const url='http://127.0.0.1:4173/gallery/visit/?date=2026-10-07&debug';
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.getElementById('enter').disabled,null,{timeout:90000});
  assert.equal(await page.evaluate(()=>window.__phiFullEngine.date),'2026-10-07');assert.match(await page.locator('#floorIndicator').innerText(),/7 Oct · Floor 3/);
  assert.equal(await page.locator('#error').isVisible(),false);assert.deepEqual(requests.filter(({url,type})=>/\/test\/virtual-gallery\//.test(url)||/tower-geometry\.bin/.test(url)||(['script','stylesheet','font'].includes(type)&&new URL(url).origin!=='http://127.0.0.1:4173')),[],'Public date entry must not import test assets, legacy geometry or external scripts');
  await page.locator('#enter').focus();await page.keyboard.press('Enter');
  if(options.isMobile){
   await page.waitForFunction(()=>document.getElementById('welcome').hidden);
   const before=await page.evaluate(()=>window.__phiLiftState.yaw);
   const origin=await page.evaluate(()=>{
    for(const y of [460,380,560,650])for(const x of [180,260,90])
     if(document.elementFromPoint(x,y)?.id==='world')return {x,y};
    return null;
   });
   assert.ok(origin,'No unobstructed canvas point for mobile touch drag');
   const touch=await context.newCDPSession(page);
   const point=(x,y)=>[{x,y,id:0,force:1}];
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(origin.x,origin.y)});
   await page.waitForTimeout(120);
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(origin.x+50,origin.y)});
   await page.waitForTimeout(120);
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(origin.x+110,origin.y)});
   await page.waitForTimeout(120);
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(y=>Math.abs(window.__phiLiftState.yaw-y)>.1,before,{timeout:10000});
   assert.ok(await page.locator('#touchNav').isVisible());await page.screenshot({path:'phi-tower-results/public-touch.png'});
  }
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.getElementById('enter').disabled,null,{timeout:90000});assert.equal(await page.evaluate(()=>window.__phiFullEngine.date),'2026-10-07');
  assert.deepEqual(errors,[]);await context.close();
 }

 // Regression: both live and test reception must place three real animated monitors.
 // This initially failed because
 // phi.world is assigned AFTER constructPhiGallery. Verify the real browser
 // scene contains three separately rendered monitor screens, not just a planner.
 for(const monitorPage of [
  {name:'test',url:'http://127.0.0.1:4173/test/virtual-gallery/full-engine.html?debug&svg-export'},
  {name:'live',url:'http://127.0.0.1:4173/gallery/visit/?debug&svg-export'}
 ]) {
  const context=await browser.newContext({viewport:{width:1200,height:800},deviceScaleFactor:.75});
  const page=await context.newPage();
  const failures=[],testRequests=[];
  page.on('pageerror',err=>failures.push(err.message));
  page.on('request',request=>testRequests.push(request.url()));
  await page.goto(monitorPage.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__phiLivingMonitorDiagnostics?.placed || !document.getElementById('error')?.hidden,null,{timeout:90000});
  const monitors=await page.evaluate(()=>{
   const scene=window.__PP_EXPORT_SCENE__?.scene;
   const root=scene?.getObjectByName('phi-reception-three-living-monitors');
   const screens=[];
   root?.traverse(child=>{if(child.name==='monitor-screen')screens.push(child);});
   const diag=window.__phiLivingMonitorDiagnostics;
   return {placed:diag?.placed,count:diag?.screenCount,screenMeshes:screens.length,rowCount:diag?.rowCount,
    wall:diag?.wall,media:diag?.media,position:root?.position.toArray(),error:document.getElementById('error')?.textContent};
  });
  assert.equal(monitors.placed,true,'Monitor creation must succeed during reception construction');
  assert.equal(monitors.count,6,'Expected six reception monitors in two rows');
  // The generated bundle may omit diagnostic-only rowCount, but screen geometry
  // and independent video sources below must prove both rows are present.
  if(monitors.rowCount!==undefined)assert.equal(monitors.rowCount,2);
  assert.equal(monitors.screenMeshes,6,'Expected six actual screen meshes in the active scene');
  assert.equal(monitors.wall?.fromPhysical,true,'Monitors must attach to real backroom wall geometry');
  assert.equal(monitors.media?.state,'fallback','TouchDesigner must not load media at gallery startup');
  assert.equal(testRequests.filter(url=>/phase-one-triptych\.webm|watercolour-burst-.*\.webm/.test(url)).length,0,
   'Neither video decoder should start at gallery startup');
  // Verify living screens actually animate, not merely show static canvases.
  // Place the automated viewer near the installed wall to exercise the
  // distance-gated render loop without relying on keyboard navigation.
  await page.evaluate(()=>{
   const {scene,camera}=window.__PP_EXPORT_SCENE__;
   const monitor=scene.getObjectByName('phi-reception-three-living-monitors');
   monitor.updateWorldMatrix(true,false);
   const p=monitor.getWorldPosition(monitor.position.clone());
   camera.parent.position.set(p.x,p.y-1.68,p.z+2);
  });
  // Published media must use the actual uploaded VP9 file, not only browser canvases.
  // The test checks the decoded, playing video on every monitor after approach.
  const declared=JSON.parse(await (await page.request.get(
   'http://127.0.0.1:4173/gallery/visit/touchdesigner/phase-one.json')).text());
  if(declared.status==='published'){
   await page.waitForFunction(()=>{
    const d=window.__phiLivingMonitorDiagnostics;
    const resolved=m=>m?.state==='playing-export'||m?.state==='awaiting-export'||(m?.state==='fallback'&&!!m?.error);
    return resolved(d?.media)&&resolved(d?.mediaWatercolour);
   },null,{timeout:20000});
   const playback=await page.evaluate(()=>{
    const scene=window.__PP_EXPORT_SCENE__.scene;
    const root=scene.getObjectByName('phi-reception-three-living-monitors');
    const meshes=[1,2,3,4,5,6].map(i=>root.getObjectByName('living-monitor-'+i).getObjectByName('monitor-screen'));
    const videos=meshes.map(m=>m.material.map.image);
    const uvs=meshes.map(m=>m.geometry.getAttribute('uv').getX(0));
    const ys=[1,2,3,4,5,6].map(i=>root.getObjectByName('living-monitor-'+i).position.y);
    return {media:window.__phiLivingMonitorDiagnostics.media,
      watercolour:window.__phiLivingMonitorDiagnostics.mediaWatercolour,
      firstRowShared:videos.slice(0,3).every(v=>v?.tagName==='VIDEO'&&v===videos[0]),
      secondRowShared:videos.slice(3,6).every(v=>v?.tagName==='VIDEO'&&v===videos[3]),
      independentVideos:videos[0]!==videos[3],
      dimensions:[videos[0]?.videoWidth,videos[0]?.videoHeight],
      watercolourDimensions:[videos[3]?.videoWidth,videos[3]?.videoHeight],
      currentTime:videos[0]?.currentTime,
      watercolourTime:videos[3]?.currentTime,uvs,ys};
   });
   assert.equal(playback.media.state,'playing-export','Top row failed playback: '+JSON.stringify(playback));
   assert.equal(playback.watercolour.state,'playing-export','Watercolour row failed playback: '+JSON.stringify(playback));
   assert.equal(playback.firstRowShared,true,'Top three screens should share one VideoTexture');
   assert.equal(playback.secondRowShared,true,'Bottom three screens should share another VideoTexture');
   assert.equal(playback.independentVideos,true,'Each row must use its own triptych');
   assert.deepEqual(playback.dimensions,[1152,240]);
   assert.deepEqual(playback.watercolourDimensions,[1152,240]);
   assert.ok(playback.ys.slice(0,3).every(y=>Math.abs(y)<.001));
   assert.ok(playback.ys.slice(3).every(y=>y<-.4),'Watercolour screens must be below original row');
   assert.ok(new Set(playback.uvs.slice(0,3).map(x=>x.toFixed(3))).size===3,'Top video must display three distinct panels');
   assert.ok(new Set(playback.uvs.slice(3).map(x=>x.toFixed(3))).size===3,'Watercolour video must display three distinct panels');
   await page.waitForTimeout(1250);
   const later=await page.evaluate(()=>{
    const root=window.__PP_EXPORT_SCENE__.scene.getObjectByName('phi-reception-three-living-monitors');
    return [1,4].map(i=>root.getObjectByName('living-monitor-'+i)
      .getObjectByName('monitor-screen').material.map.image.currentTime);
   });
   assert.ok(later[0]>playback.currentTime+.5,
    'Original TouchDesigner video time must advance while the visitor is nearby');
   assert.ok(later[1]>playback.watercolourTime+.5,
    'Watercolour TouchDesigner video time must advance while the visitor is nearby');
   assert.ok(testRequests.some(url=>url.includes('phase-one-triptych.webm')),
    'Original TouchDesigner WebM must be requested');
   assert.ok(testRequests.some(url=>url.includes('watercolour-burst-AA-20261005-03-55769-triptych.webm')),
    'Watercolour TouchDesigner WebM must be requested');
   console.log('Real TouchDesigner videos play on both three-monitor rows:',playback);
  }else{
   const readFrames=()=>page.evaluate(()=>{
    const scene=window.__PP_EXPORT_SCENE__.scene;
    const root=scene.getObjectByName('phi-reception-three-living-monitors');
    return [1,2].map(i=>{
     const mesh=root.getObjectByName('living-monitor-'+(i+1)).getObjectByName('monitor-screen');
     const canvas=mesh.material.map.image;
     const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
     let hash=2166136261;
     for(let j=0;j<bytes.length;j+=37)hash=Math.imul(hash^bytes[j],16777619)>>>0;
     return hash;
    });
   });
   await page.waitForTimeout(550);
   const before=await readFrames();
   await page.waitForTimeout(1100);
   const after=await readFrames();
   assert.ok(before.every((hash,i)=>hash!==after[i]),
    'Both fallback screens must change pixels over time when approached');
  }
  assert.deepEqual(failures,[],'Test gallery generated browser errors');
  console.log('Three '+monitorPage.name+' reception monitors and TouchDesigner media:',monitors);
  await context.close();
 }
 console.log('Public dated entry, refresh, touch look and mobile viewport passed at full pixel density');
}finally{await browser.close();}
