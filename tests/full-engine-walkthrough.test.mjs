import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('phi-tower-results',{recursive:true});
// Keep the complete desktop scene; halve pixel density for software WebGL in CI.
const browser=await chromium.launch({headless:true});
let page;
try{
 page=await browser.newPage({viewport:{width:1365,height:850},deviceScaleFactor:.5});
 const errors=[],warnings=[],threeImports=new Set();
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());});
 page.on('request',request=>{if(/\/build\/three\.module\.js(?:\?|$)/.test(request.url()))threeImports.add(request.url());});
 await page.goto('http://127.0.0.1:4173/test/virtual-gallery/full-engine.html?debug',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled || !document.querySelector('#error')?.hidden || window.__galleryStartupError,null,{timeout:90000});
 assert.equal(await page.locator('#error').isVisible(),false,'Gallery startup error visible');
 assert.equal(await page.locator('#enter').isEnabled(),true,'Gallery did not finish preparing');
 const phi=await page.evaluate(()=>window.__phiFullEngine);
 assert.ok(phi?.wallCount>0&&phi.roomCount>0,'Missing phi architecture');
 assert.equal(phi.artworks,phi.paintings+phi.sculptures,'Phi curator dropped art');
 assert.equal(phi.unplaced,0,'Unplaced artworks');
 const plaza=await page.evaluate(()=>window.__phiPlaza);
 assert.equal(plaza?.monumentCount,2);
 assert.equal(plaza.benchCount,8);assert.equal(plaza.tagWalls,4);assert.equal(plaza.squareMonumentCount,3);assert.equal(plaza.tags,85);
 assert.ok(await page.locator('#welcomeTitle').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)<=50),'Welcome heading too large');
 const tower=await page.evaluate(()=>window.__phiTowerExterior);
 assert.ok(tower?.otherFloors>0&&tower.wallMeshes>tower.otherFloors,'Missing exterior tower');
 assert.ok(await page.evaluate(()=>window.__phiReception?.desk&&window.__phiReception?.information),'Missing ground-floor reception');
 assert.equal(await page.evaluate(()=>window.__phiReceptionCredits?.count),3,'Missing framed credit collection');
 await page.waitForFunction(()=>window.__phiLiftState?.entranceModelLoaded&&window.__phiLiftState?.propsLoaded===3&&window.__phiLiftState?.outdoorPlantsLoaded===4&&window.__phiLiftState?.worldMapLoaded,null,{timeout:45000});
 assert.equal(await page.evaluate(()=>window.__phiLiftState.outdoorPlantsReplaced),16,'Low-poly planting was not replaced');
 assert.ok(await page.evaluate(()=>window.__phiReception.worldMap.width>=6),'Missing giant reception map');
 assert.equal(await page.evaluate(()=>window.__galleryStartupError),'');
 await page.waitForFunction(()=>window.__phiSquareGraffiti?.diagnostics().painted===85,null,{timeout:90000});
 const writing=await page.evaluate(()=>({diagnostics:window.__phiSquareGraffiti.diagnostics(),words:[...new Set(window.__phiSquareGraffiti.marks().map(m=>m.text))],forms:[...new Set(window.__phiSquareGraffiti.marks().map(m=>m.form))],hands:[...new Set(window.__phiSquareGraffiti.marks().map(m=>m.hand))]}));
 assert.equal(writing.diagnostics.pending,0);assert.deepEqual(writing.diagnostics.errors,[]);assert.match(writing.diagnostics.revision,/golden-eight/);assert.equal(writing.forms.length,8);assert.ok(writing.hands.length>=25);assert.ok(!writing.hands.includes('loop'),'Excluded Loop profile returned');assert.deepEqual(new Set(writing.words),new Set(['PHI','φ']));
 await page.screenshot({path:'phi-tower-results/full-welcome.png'});
 await page.locator('#enter').focus();await page.keyboard.press('Enter');
 await page.screenshot({path:'phi-tower-results/full-entrance.png'});
 await page.evaluate(()=>window.__phiSquareGraffiti.preview());
 await page.screenshot({path:'phi-tower-results/tagged-square.png'});
 await page.evaluate(()=>window.__phiSquareGraffiti.resume());
 await page.evaluate(()=>window.__phiReceptionPreview.show('map'));await page.screenshot({path:'phi-tower-results/reception-world-map.png'});
 await page.evaluate(()=>window.__phiReceptionPreview.show('plant'));await page.screenshot({path:'phi-tower-results/outdoor-succulent.png'});
 await page.evaluate(()=>window.__phiReceptionPreview.resume());
 // Historical floors that previously rejected one or two portrait sculptures.
 for(const date of ['2026-10-07','2026-10-14','2026-10-18','2026-10-26']){
  await page.locator('#openLift').click({noWaitAfter:true});
  await page.locator('#lift').waitFor({state:'visible'});
  const destination=page.locator('#liftDays button').filter({hasText:new RegExp('^'+Number(date.slice(-2))+'$')});
  if(date==='2026-10-14')await page.evaluate(()=>{
   window.__liftDisplaySamples=[];let seenMoving=false;
   const sample=()=>{const s=window.__phiLiftState?.indicator;if(s?.phase==='moving')seenMoving=true;if(s?.phase==='moving'&&!window.__liftDisplaySamples.some(v=>v.floor===s.floor))window.__liftDisplaySamples.push(s);if(!seenMoving||window.__phiLiftRide?.status!=='ready')requestAnimationFrame(sample);};
   requestAnimationFrame(sample);
  });
  await destination.click({noWaitAfter:true});
  await page.waitForFunction(()=>window.__phiLiftRide?.status==='moving',null,{timeout:90000});
  const before=await page.evaluate(()=>window.__phiLiftState);
  assert.equal(before.doorCount,2);assert.equal(before.calendarCount,1);
  assert.ok(before.doorClosure>.99,'Cabin moved with doors open');
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(280);await page.keyboard.up('ArrowUp');
  const during=await page.evaluate(()=>window.__phiLiftState);
  assert.ok(during.pitch>before.pitch+.05,'Looking around was locked during the ride');
  assert.ok(Math.abs(during.y-before.y)>.03,'Cabin did not move');
  assert.ok(Math.abs(during.cabinY-during.y)<.01,'Cabin left the visitor behind');
  await page.waitForFunction(()=>window.__phiLiftRide?.status==='ready',null,{timeout:90000});
  await page.keyboard.down('ArrowDown');await page.waitForTimeout(280);await page.keyboard.up('ArrowDown');
  const state=await page.evaluate(()=>({lift:window.__phiLiftState,exhibition:window.__phiFullEngine,error:window.__phiLiftError}));
  assert.equal(state.error,null);assert.equal(state.exhibition.date,date);
  assert.equal(state.exhibition.artworks,state.exhibition.paintings+state.exhibition.sculptures);
  assert.equal(state.exhibition.unplaced,0);
  assert.ok(await page.evaluate(()=>window.__phiFurnishings?.standing>=1&&window.__phiFurnishings?.benches>=1),'Missing gallery visitors or seating');assert.ok(state.lift.doorClosure<.025,'Arrival doors did not open');
  assert.equal(state.lift.calendarCount,1);assert.equal(state.lift.doorCount,2);
  assert.equal(state.lift.indicator.floor,state.lift.floor);assert.match(state.lift.indicator.primary,new RegExp('^'+state.lift.floor+' · '));assert.match(state.lift.indicatorFont,/AlgoArt Marker/);
  if(date==='2026-10-07'){
   assert.ok(state.exhibition.paintingSizes.filter(p=>p.width>=4.5).length>=3,'Sparse walls kept their small paintings');
  }
  if(date==='2026-10-14'){
   const samples=await page.evaluate(()=>window.__liftDisplaySamples);
   assert.ok(samples.length>=3,'Lift display did not change through passing floors');assert.ok(samples.every(s=>s.phase==='moving'&&/Ascending to/.test(s.secondary)));
   await writeFile('phi-tower-results/lift-display-samples.json',JSON.stringify(samples,null,2));
  }
  assert.equal(await page.locator('#lift').isVisible(),false,'Calendar reopened on arrival');
  assert.equal(await page.locator('#liftAnimation').isVisible(),false,'Old cutscene appeared');
  await page.screenshot({path:'phi-tower-results/lift-'+date+'.png'});
  // Leave through the opened door using the visitor's keyboard controls.
  const heading=state.lift.floor*(2*Math.PI/(((1+Math.sqrt(5))/2)**2))-Math.PI/2;
  const turn=Math.atan2(Math.sin(heading-state.lift.yaw),Math.cos(heading-state.lift.yaw));
  if(Math.abs(turn)>.1){
   const key=turn>0?'ArrowLeft':'ArrowRight';await page.keyboard.down(key);
   try{await page.waitForFunction(target=>Math.abs(Math.atan2(Math.sin(window.__phiLiftState.yaw-target),Math.cos(window.__phiLiftState.yaw-target)))<.1,heading,{timeout:90000});}
   finally{await page.keyboard.up(key);}
  }
  await page.keyboard.down('w');
  try{await page.waitForFunction(()=>Math.hypot(window.__phiLiftState.x,window.__phiLiftState.z)>3.1,null,{timeout:90000});}
  finally{await page.keyboard.up('w');}
  assert.equal(await page.locator('#lift').isVisible(),false,'Calendar interrupted the exit');
  if(date==='2026-10-07')await page.waitForFunction(()=>window.__phiFullEngine.paintingsLoaded===window.__phiFullEngine.paintings,null,{timeout:60000});
  await page.screenshot({path:'phi-tower-results/gallery-'+date+'.png'});
 }
 // An unavailable destination must preserve the departure exhibition and position.
 const departure=await page.evaluate(()=>window.__phiLiftState);
 await page.route('**/gallery/2026-10-15/',route=>route.fulfill({status:503,body:'Unavailable'}));
 await page.locator('#openLift').click({noWaitAfter:true});
  await page.locator('#lift').waitFor({state:'visible'});
 await page.locator('#liftDays button').filter({hasText:/^15$/}).click({noWaitAfter:true});
 await page.waitForFunction(()=>window.__phiLiftError,null,{timeout:25000});
 assert.equal(await page.evaluate(()=>window.__phiFullEngine.date),departure.date);
 await page.locator('#closeLift').click({noWaitAfter:true});
 await page.waitForFunction(()=>!window.__phiLiftState.travelling);
 const recovered=await page.evaluate(()=>window.__phiLiftState);
 assert.ok(Math.abs(recovered.y-departure.y)<.01,'Failed destination changed visitor elevation');
 assert.ok(Math.hypot(recovered.x-departure.x,recovered.z-departure.z)<.02,'Failed destination stranded visitor');
 await page.unroute('**/gallery/2026-10-15/');
 // Ground floor is a separate, reachable reception rather than an archive date.
 await page.locator('#openLift').click({noWaitAfter:true});
  await page.locator('#lift').waitFor({state:'visible'});await page.locator('#liftReception').click({noWaitAfter:true});
 await page.waitForFunction(()=>window.__phiLiftRide?.status==='ready',null,{timeout:90000});
 assert.equal(await page.evaluate(()=>window.__phiFullEngine.date),'__phi_reception__');
 assert.equal(await page.evaluate(()=>window.__phiLiftState.indicator.primary),'G · Reception');
 assert.equal(await page.evaluate(()=>window.__phiSquareGraffiti.diagnostics().painted),85,'Square atlas did not survive a reception return');
 assert.equal(await page.locator('#error').isVisible(),false);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'phi-tower-results/full-mobile.png'});
 assert.equal(threeImports.size,1,'Multiple Three.js module URLs');
 assert.ok(!warnings.some(s=>/Multiple instances of Three\.js/.test(s)),'Duplicate Three.js warning');
 assert.equal(errors.length,0,errors.join('; '));
 console.log('Full gallery: 85 mixed square tags in eight forms and golden-angle groups, larger paintings, succulent planters, giant reception map, smaller welcome, live marker lift indicator, historical rides, free look, doors, failed-load recovery and one Three.js instance passed');
}catch(error){
 if(page){
  console.error('Gallery state on failure',await page.evaluate(()=>({ride:window.__phiLiftRide,lift:window.__phiLiftState,error:window.__phiLiftError,events:window.__galleryDebugEvents})));
  await page.screenshot({path:'phi-tower-results/full-failure.png'}).catch(()=>{});
  await writeFile('phi-tower-results/failure.json',JSON.stringify(await page.evaluate(()=>({ride:window.__phiLiftRide,lift:window.__phiLiftState,error:window.__phiLiftError,events:window.__galleryDebugEvents})),null,2));
 }
 throw error;
}finally{await browser.close();}
