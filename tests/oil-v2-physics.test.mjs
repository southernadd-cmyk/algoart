// Targeted Oil V2 physics and compatibility verification. This does not
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
  await page.addScriptTag({url:'/js/oil-paint-v1.js'});
  await page.addScriptTag({url:'/js/oil-paint-v2.js'});
  const d=await page.evaluate(()=>{
    const A=window.AlgoArt;
    const accumulation=[
      A.oilPaintV2Test.addPaintHeight(0,.5,1),
      A.oilPaintV2Test.addPaintHeight(.5,.5,1),
      A.oilPaintV2Test.addPaintHeight(3.9,.5,1)
    ];
    const s={...A.readSettings(),seed:'OILV2-PHYSICS-20261014',
      mode:'rects',orientation:'landscape',elements:40,density:69,
      complexity:73,phiStrength:94,palette:'golden',paper:'#f5f0e6'};
    const before={fit:A.phiFramingEnabled,recorder:A.svgRecorder};
    const c1=document.createElement('canvas'),c2=document.createElement('canvas');
    const opts={phiFraming:true,thickness:.86,drag:.62,
      bristles:.90,massing:.44,relief:.78};
    const old=A.renderOilPaintV1(document.createElement('canvas'),s,.34,{
      phiFraming:true,thickness:.8,drag:.54,bristles:.88
    });
    const t1=A.renderOilPaintV2(c1,s,.34,opts);
    const t2=A.renderOilPaintV2(c2,s,.34,opts);
    return {accumulation,old,t1,t2,equal:c1.toDataURL('image/png')===
      c2.toDataURL('image/png'),dimensions:[c1.width,c1.height],
      fitUnchanged:A.phiFramingEnabled===before.fit,
      recorderUnchanged:A.svgRecorder===before.recorder};
  });
  assert.deepEqual(d.accumulation,[.5,1,4],
    'Oil V2 height must add at overlaps with a safe maximum');
  assert.equal(d.equal,true,'V2 images change between identical seed runs');
  assert.equal(d.fitUnchanged,true);
  assert.equal(d.recorderUnchanged,true);
  assert.deepEqual(d.dimensions,[476,340]);
  assert.equal(d.t1.material,'oil-paint-v2');
  assert(d.t1.sourcePaths>0&&d.t1.paintedPaths>0);
  assert(d.t1.eligiblePaths>=d.t1.paintedPaths);
  assert.equal(d.t1.profiles.flat+d.t1.profiles.filbert,d.t1.paintedPaths);
  assert(d.t1.profiles.flat>0,'Rects should use flat brushes');
  assert(d.t1.height.heightPeak>.2&&d.t1.height.heightP95>.15,
    'Relief is too weak or no height was deposited');
  assert(d.t1.height.heightBytes===476*340*4);
  assert(d.t1.phases.totalMs>0&&d.t1.phases.paintMs>0);
  assert(d.t1.sourceColours.length>0&&d.old.sourceColours.length>0);
  assert.deepEqual(errors,[]);
  console.log('PASS additive paint load',d.accumulation.join(','));
  console.log('PASS V2 deterministic drawing, source paths',d.t1.sourcePaths,
    'painted',d.t1.paintedPaths,'profiles',JSON.stringify(d.t1.profiles),
    'height P95',d.t1.height.heightP95,'time',d.t1.phases.totalMs+'ms');
}finally{
  await browser.close();
}
