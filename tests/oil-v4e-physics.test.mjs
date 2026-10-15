// Targeted Oil V3 physics and compatibility verification. This does not
// invoke any external image-generation service or publish any artwork.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1200,height:820}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/',{
    waitUntil:'domcontentloaded',timeout:60000
  });
  await page.addScriptTag({url:'/js/oil-paint-v2.js'});
  await page.addScriptTag({url:'/js/oil-paint-v3.js'});
  await page.addScriptTag({url:'/js/oil-paint-v4.js'});
  await page.addScriptTag({url:'/js/oil-paint-v4c.js'});
  await page.addScriptTag({url:'/js/oil-paint-v4d.js'});
  await page.addScriptTag({url:'/js/oil-paint-v4e.js'});
  const d=await page.evaluate(()=>{
    const A=window.AlgoArt;
    const accumulation=[
      A.oilPaintV4ETest.addPaintHeight(0,.5,1),
      A.oilPaintV4ETest.addPaintHeight(.5,.5,1),
      A.oilPaintV4ETest.addPaintHeight(3.9,.5,1)
    ];
    const s={...A.readSettings(),seed:'OILV2-PHYSICS-20261014',
      mode:'rects',orientation:'landscape',elements:40,density:69,
      complexity:73,phiStrength:94,palette:'golden',paper:'#f5f0e6'};
    const before={fit:A.phiFramingEnabled,recorder:A.svgRecorder};
    const c1=document.createElement('canvas'),c2=document.createElement('canvas');
    const opts={phiFraming:true,thickness:.90,drag:.72,
      bristles:.92,massing:.44,relief:.87};
    const old=A.renderOilPaintV4D(document.createElement('canvas'),s,.34,{
      phiFraming:true,thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87
    });
    const t1=A.renderOilPaintV4E(c1,s,.34,opts);
    const t2=A.renderOilPaintV4E(c2,s,.34,opts);
    const smooth=A.oilPaintV3Test.smoothTooth;
    const surfaceSamples=[smooth(3,8,123),smooth(4,8,123),
      smooth(5,8,123),smooth(6,8,123)];
    const pressureSample=Array.from({length:41},(_,i)=>A.oilPaintV4ETest.pressureAt(
      i*2.5,100,.7,'filbert'));
    const labCanvas=document.createElement('canvas');
    const labStats=A.oilPaintV4ETest.drawBrushLab(labCanvas,{seed:'V4-LAB-SEED'});
    const labHash=labCanvas.toDataURL('image/png');
    const repeatLab=A.oilPaintV4ETest.drawBrushLab(
      document.createElement('canvas'),{seed:'V4-LAB-SEED'});
    const wetCanvas=document.createElement('canvas');
    const wet=A.oilPaintV4ETest.drawWetCrossingLab(wetCanvas,
      {seed:'V4E-CROSSING-FIXED'});
    const base=new Float32Array(21*21);
    base[10*21+9]=.4;base[10*21+10]=1.2;base[10*21+11]=2.1;
    const lighting=A.oilPaintV4ETest.surfaceLighting(base,21,21,10,10,.85);
    return {accumulation,old,t1,t2,wet,lighting,surfaceSamples,pressureSample,
      labStats,repeatLab,labNonempty:labHash.length>30000,equal:c1.toDataURL('image/png')===
      c2.toDataURL('image/png'),dimensions:[c1.width,c1.height],
      fitUnchanged:A.phiFramingEnabled===before.fit,
      recorderUnchanged:A.svgRecorder===before.recorder};
  });
  assert.deepEqual(d.accumulation,[.5,1,4.4],
    'Oil V3 height must add at overlaps with a safe maximum');
  assert.equal(d.equal,true,'V4 images change between identical seed runs');
  assert.equal(d.fitUnchanged,true);
  assert.equal(d.recorderUnchanged,true);
  assert.deepEqual(d.dimensions,[476,340]);
  assert.equal(d.t1.material,'oil-paint-v4e');
  assert(d.t1.sourcePaths>0&&d.t1.paintedPaths>0);
  assert(d.t1.eligiblePaths>=d.t1.paintedPaths);
  assert.equal(Object.values(d.t1.profiles).reduce((a,b)=>a+b,0),d.t1.paintedPaths);
  assert(d.t1.profiles.flat>0,'Rects should use flat brushes');
  assert(d.t1.height.heightPeak>.2&&d.t1.height.heightP95>.15,
    'Relief is too weak or no height was deposited');
  assert(d.t1.height.heightBytes===476*340*4);
  assert(d.t1.height.heightAtCapFraction<.25,'V4 surface height still mostly saturated');
  assert(d.t1.height.heightPeak>0&&d.t1.height.heightPeak<=18);
  assert.equal(d.t1.revision,'4e-wet-transfer-and-normal-light');
  assert(d.t1.pickupMarks>0,'Oil V4e should encounter wet pigment crossings');
  assert(d.t1.wetDragMarks>0,'Crossings must transfer actual paint');
  assert(d.t1.height.meanSpecular>=0,'Surface-normal lighting missing');
  assert(d.t1.contactFootprints>d.t1.paintedPaths,
    'Pigment must be deposited from multiple actual contacts');
  assert(d.t1.paintLoadStart>d.t1.paintLoadEnd,
    'Brush reservoir must lose real paint volume along the stroke');
  assert(d.t1.paintLoadEnd>.05,
    'Depleting brush may not erase pigment altogether');
  assert(d.t1.bristleRuns>d.t1.paintedPaths,
    'Each paint path must have multiple actual bristle deposits');
  assert(d.t1.bristleContacts>d.t1.paintedPaths,
    'Missing pressure-driven bristle contact');
  assert(Number.isInteger(d.t1.pickupMarks)&&d.t1.pickupMarks>=0);
  assert(d.t1.paintPatches>0,'Oil material is missing local mass deposits');
  assert(d.labNonempty&&d.labStats.studies===16,'V4 brush lab not drawn');
  assert.equal(d.wet.cases[0].second.wetDragMarks,0,
    'Disabling wet transfer must leave control unmodified');
  assert(d.wet.cases[1].second.pickupMarks>0,
    'Synthetic crossing should actually sample earlier pigment');
  assert(d.wet.cases[1].second.wetDragMarks>0,
    'Synthetic crossing must physically drag previous pigment');
  assert(d.wet.colourDifference>300,
    'With and without wet transfer should visibly differ');
  assert(d.lighting.shade>.71&&d.lighting.shade<1.24);
  assert.deepEqual(d.labStats.profiles,['filbert','flat','dry','knife']);
  assert(d.pressureSample.every(n=>n>.07&&n<1.1));
  assert(d.pressureSample.slice(1).every((n,i)=>Math.abs(n-d.pressureSample[i])<.17),
    'Pressure must vary continuously rather than jump between pixel stamps');
  assert(d.t1.pressureRange[1]>d.t1.pressureRange[0],
    'Oil brush needs meaningful changing pressure');
  assert.equal(d.t1.squarePixelTooth,false,
    'Surface texture must not be generated in square raster cells');
  assert(d.surfaceSamples.every((v,i,a)=>i===0||Math.abs(v-a[i-1])>1e-7),
    'Canvas tooth still snaps into raster-grid blocks');


  assert(d.t1.phases.totalMs>0&&d.t1.phases.paintMs>0);
  assert(d.t1.sourceColours.length>0&&d.old.sourceColours.length>0);
  assert.deepEqual(errors,[]);
  console.log('PASS additive paint load',d.accumulation.join(','));
  console.log('PASS V4 deterministic drawing, source paths',d.t1.sourcePaths,
    'painted',d.t1.paintedPaths,'profiles',JSON.stringify(d.t1.profiles),
    'height P95',d.t1.height.heightP95,'time',d.t1.phases.totalMs+'ms');
}finally{
  await browser.close();
}
