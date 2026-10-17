// Oil v1 paper colour regression. Uses the actual ALGO/ART Chromium
// renderer, UI and PNG export. No AI or postprocessed image replacement.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1540,height:1000}});
 await page.addInitScript(()=>localStorage.setItem('algoart-inspector-desktop','open'));
page.setDefaultTimeout(90000);
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto((process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/')+
  '?v=9&seed=OIL-PAPER-COLOUR-FIX-20261015&mode=spiral&material=oil-v1&paper=%23f5f0e6',
  {waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>document.querySelector('#materialStyle')?.value==='oil');
 const result=await page.evaluate(()=>{
  const A=window.AlgoArt,
    base={...A.readSettings(),mode:'spiral',orientation:'portrait',
      seed:'OIL-PAPER-SAME-GEOMETRY-20261015'},
    make=(paper)=>{
      const c=document.createElement('canvas'),
        metadata=A.renderOilPaintV1(c,{...base,paper},.22,false),
        pixel=c.getContext('2d').getImageData(2,2,1,1).data;
      const oil=A.lastOilPaintV4EStats;
      return {
        url:c.toDataURL(),pixel:[...pixel],
        dims:[c.width,c.height],
        source:{paths:oil.sourcePaths,eligible:oil.eligiblePaths,
          painted:oil.paintedPaths,massGroups:oil.massGroups,
          colours:oil.sourceColours,guide:metadata.guide,
          voids:metadata.voids,plan:metadata.plan.connectedFields.map(f=>({
            id:f.id,seed:f.seed,guideIds:f.guideIds,contour:f.contour
          }))},
        work:metadata.work.oilV1
      };
    };
  return{
    cream:make('#f5f0e6'),
    azure:make('#79bfe3'),
    dark:make('#283f57'),
    azureAgain:make('#79bfe3')
  };
 });
 for(const x of ['azure','dark']){
   assert.notEqual(result.cream.url,result[x].url,
     'Oil output ignores paper #'+x);
   assert.deepEqual(result.cream.source,result[x].source,
     'Paper colour changed the planned source geometry/seed');
   assert.deepEqual(result.cream.work,result[x].work,
     'Paper colour changed the actual source-linked oil strokes');
   assert.deepEqual(result.cream.dims,result[x].dims);
   assert.notDeepEqual(result.cream.pixel,result[x].pixel,
     'Unpainted canvas corner did not respond to paper selection');
 }
 assert.equal(result.azure.url,result.azureAgain.url,
   'Paper colour causes nondeterministic Oil rerender');
 assert.deepEqual(result.cream.dims,[220,308]);

 const original=await page.locator('#art').evaluate(c=>c.toDataURL());
 await page.locator('#tab-colour').click(); // Paper control lives in the Colour tab.
 await page.locator('#paper').fill('#79bfe3');
 await page.waitForFunction(()=>
   new URLSearchParams(location.search).get('paper')==='#79bfe3');
 const current=await page.locator('#art').evaluate(c=>({
   url:c.toDataURL(),
   top:[...c.getContext('2d').getImageData(2,2,1,1).data]
 }));
 assert.notEqual(current.url,original,
   'Live Oil does not repaint when Paper control changes');
 assert.equal(await page.locator('#materialStyle').inputValue(),'oil');
 assert.match(page.url(),/material=oil-v1/);
 assert.equal(new URL(page.url()).searchParams.get('paper'),'#79bfe3');

 const exported=await page.evaluate(async()=>{
   const A=window.AlgoArt,
     settings={...A.readSettings(),oilPaintRender:true,
       oilRender:false,watercolourRender:false},
     file=await A.preparePNG(settings,1);
   const image=await createImageBitmap(file.blob),
     c=document.createElement('canvas');
   c.width=image.width;c.height=image.height;
   c.getContext('2d').drawImage(image,0,0);
   const pixel=[...c.getContext('2d').getImageData(2,2,1,1).data];
   image.close();
   return{filename:file.filename,bytes:file.bytes,pixel,
     width:c.width,height:c.height};
 });
 assert.deepEqual(exported.pixel,current.top,
   'Oil PNG export ignores the paper colour visible in the editor');
 assert(exported.bytes>35000);
 assert.match(exported.filename,/oil-paint-v1-1x\.png$/);
 assert.deepEqual([exported.width,exported.height],[1400,1000]);
 await page.locator('#paper').fill('#f5f0e6');
 await page.waitForFunction(()=>
   new URLSearchParams(location.search).get('paper')==='#f5f0e6');
 assert.equal(await page.locator('#art').evaluate(c=>c.toDataURL()),original,
   'Returning to default cream must restore exact original Oil pixels');

 // Paper is source-only: neither the oil material nor SVG/plotter material
 // semantics should silently change when the user changes paper.
 assert.deepEqual(errors,[]);
 console.log('PASS Oil paper colour: 3 paper colours, identical source paint, deterministic reproduction, live UI and PNG match, share URL round-trip',JSON.stringify({
   cream:result.cream.pixel,azure:result.azure.pixel,
   dark:result.dark.pixel,png:exported.filename
 }));
}finally{
 await browser.close();
}
