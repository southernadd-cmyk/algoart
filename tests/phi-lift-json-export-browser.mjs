import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const base=process.env.PHI_TEST_SERVER||'http://127.0.0.1:4173';
const data={
 version:3,active:false,
 visits:[{
  fromFloor:0,toFloor:28,date:'2026-11-01',
  start:100,
  summary:{ms:520,frameP50Ms:16.7,frameP95Ms:80,largestFrameGapMs:90,
   operationTotals:{'render-frame-postfx':{count:1,totalMs:60,maxMs:60}}},
  frameMs:[16.7,90],
  frames:[{elapsedMs:190,deltaMs:90,stage:'scene-reveal-start'}],
  operations:[{name:'render-frame-postfx',elapsedMs:120,durationMs:60}],
  stages:[{name:'selection',elapsedMs:0},{name:'scene-reveal-start',elapsedMs:180},
   {name:'doors-opening',elapsedMs:490},{name:'doors-fully-open',elapsedMs:520}],
  longTasks:[]
 }]
};
async function pageFor(viewport){
 const context=await browser.newContext({viewport,acceptDownloads:true});
 const page=await context.newPage();
 // UI is intentionally independent of the WebGL bundle. Avoid a heavy
 // software-renderer run: this checks that the export button works.
 await page.route('**/gallery-phi-bundle.js*',route=>route.abort());
 await page.goto(base+'/test/virtual-gallery/full-engine.html',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#phiBenchToggle',{state:'attached',timeout:20000});
 await page.evaluate(profile=>{window.__phiLiftProfile=profile;},data);
 return {page,context};
}
try{
 const {page,context}=await pageFor({width:1280,height:800});
 await page.locator('#phiBenchToggle').click();
 assert.equal(await page.locator('#phiBenchPanel').isVisible(),true);
 assert.match(await page.locator('#phiBenchTrips').innerText(),/G → 28/);
 const downloadPromise=page.waitForEvent('download',{timeout:15000});
 await page.locator('[data-action="download"]').click();
 const download=await downloadPromise;
 assert.match(download.suggestedFilename(),/proportion-piece-lift.*\.json/);
 const json=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(json.summary.journeys,1);
 assert.equal(json.journeys[0].worstFrames[0].attribution.operation,'render-frame-postfx');
 console.log('LIFT_JSON_DESKTOP_DOWNLOAD_OK',json.journeys[0].worstFrames[0].attribution);
 await context.close();

 const mobile=await pageFor({width:390,height:844});
 await mobile.page.locator('#mobileMenuToggle').click();
 await mobile.page.locator('#phiBenchToggle').click();
 assert.equal(await mobile.page.locator('#phiBenchPanel').isVisible(),true);
 assert.match(await mobile.page.locator('#phiBenchTrips').innerText(),/G → 28/);
 console.log('LIFT_JSON_MOBILE_PANEL_OK');
 await mobile.context.close();
}finally{await browser.close()}
