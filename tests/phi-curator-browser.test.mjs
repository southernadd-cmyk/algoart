import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
await mkdir('phi-curator-results',{recursive:true});
try {
 for (const mobile of [false,true]) {
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1400,height:900}});
  const page=await ctx.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/gallery/visit/phi-study/',{waitUntil:'domcontentloaded'});
  for (const placement of ['original','curated']) {
   await page.locator('#placement').selectOption(placement);
   await page.waitForFunction(mode=>document.getElementById('facts')?.textContent?.startsWith(mode==='original'?'ORIGINAL FIRST-FIT':'CURATOR V1'),placement,{timeout:60000});
   const summary=await page.locator('#facts').textContent();
   assert.match(summary,/paintings.*sculptures.*unplaced/);
   assert.match(summary,/0 unplaced/,'Artwork missing from '+placement+' placement');
   assert.match(summary,/all rooms connected/,'Gallery route is disconnected');
   assert.doesNotMatch(summary,/ERROR|WARNING/,'Placement diagnostics reported errors');
   const suffix=(mobile?'mobile':'desktop')+'-'+placement;
   await page.locator('#rooms').screenshot({path:'phi-curator-results/'+suffix+'-plan.png'});
   await page.locator('#threePreview').screenshot({path:'phi-curator-results/'+suffix+'-3d.png'});
   console.log(suffix,summary);
  }
  assert.deepEqual(errors,[]);
  await ctx.close();
 }
} finally {await browser.close();}
