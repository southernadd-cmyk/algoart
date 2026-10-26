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
  for (const date of ['2026-10-17','2026-10-23','2026-10-26']) {
   const archive=await page.evaluate(async date=>{const response=await fetch('/gallery/'+date+'/');if(!response.ok)throw Error('Missing archive '+date);const doc=new DOMParser().parseFromString(await response.text(),'text/html');return doc.querySelectorAll('article.art-card').length;},date);
   assert(archive>0,'Archive must contain artworks: '+date);
   await page.locator('#date').fill(date);
   for (const placement of ['original','curated']) {
   await page.locator('#placement').selectOption(placement);
   await page.waitForFunction(mode=>document.getElementById('facts')?.textContent?.startsWith(mode==='original'?'ORIGINAL FIRST-FIT':'CURATOR V1'),placement,{timeout:60000});
   const summary=await page.locator('#facts').textContent();
   assert.match(summary,/paintings.*sculptures.*unplaced/);
   const parsed=summary.match(/(\d+) paintings.*?(\d+) sculptures.*?(\d+) unplaced/);
   assert(parsed,'Could not parse artwork totals: '+summary);
   assert.equal(Number(parsed[1])+Number(parsed[2])+Number(parsed[3]),archive,'Mismatch with archive '+date);
   assert.match(summary,/0 unplaced/,'Artwork missing from '+placement+' placement');
   assert.match(summary,/all rooms connected/,'Gallery route is disconnected');
   assert.doesNotMatch(summary,/ERROR|WARNING/,'Placement diagnostics reported errors');
   const suffix=date+'-'+(mobile?'mobile':'desktop')+'-'+placement;
   await page.locator('#rooms').screenshot({path:'phi-curator-results/'+suffix+'-plan.png'});
   await page.locator('#threePreview').screenshot({path:'phi-curator-results/'+suffix+'-3d.png'});
   console.log(suffix,summary);
  }
  }
  await page.goto('http://127.0.0.1:4173/test/virtual-gallery/phi-rehearsal.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('facts')?.textContent?.startsWith('CURATOR V1'),null,{timeout:60000});
  const rehearsal=await page.locator('#facts').textContent();
  assert.match(rehearsal,/paintings.*sculptures.*0 unplaced/);
  assert.match(rehearsal,/all rooms connected/);
  await page.locator('#threePreview').screenshot({path:'phi-curator-results/'+(mobile?'mobile':'desktop')+'-rehearsal.png'});
  console.log('rehearsal',rehearsal);
  assert.deepEqual(errors,[]);
  await ctx.close();
 }
} finally {await browser.close();}
