import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const pair=[];
for(const orientation of ['landscape','portrait']){
 const folder='social-output/2026-10-18/action/'+orientation;
 const queue=JSON.parse(await fs.readFile(folder+'/queue.json','utf8'));
 assert.equal(queue.material,'action');
 assert.equal(queue.orientation,orientation);
 assert.equal(queue.entries.length,1);
 for(const item of queue.entries){
  pair.push(item);
  assert.equal(item.material,'action');
  assert.equal(new URL(item.shareUrl).searchParams.get('material'),'action-v1');
  assert.match(item.id,/^2026-10-18-AC[LP]01$/);
  assert.match(item.copy.instagram,/ACTION PAINTING V1/);
  assert.equal(item.platforms.instagram.scheduledTime,'09:00');
  assert.equal(item.platforms.threads.scheduledTime,'09:00');
  assert.equal(item.platforms.bluesky.scheduledTime,'09:00');
  assert.ok(item.copy.bluesky.includes('?art='));
  await fs.access(folder+'/'+item.imageFile);
 }
}
console.log('Action Painting portrait and landscape social queues validated (release gate)');

assert.notEqual(pair[0].mode,pair[1].mode,'daily action modes must differ');
assert.notEqual(pair[0].settings.palette,pair[1].settings.palette,'daily action palettes must differ');

import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:4173/?seed=ACTION-COLOR-TEST&material=action-v1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#creatingOverlay')?.hidden===true,{timeout:120000});
 // The material picker must no longer inherit generic monochrome defaults.
 const settings=await page.evaluate(()=>({
   palette:document.getElementById('palette').value,
   colours:+document.getElementById('colourCount').value
 }));
 // Deep links can explicitly request monochrome; test ordinary selection.
 await page.locator('#materialStyle').selectOption('marker');
 await page.locator('#palette').evaluate(el=>{el.value='mono';el.dispatchEvent(new Event('change',{bubbles:true}))});
 await page.locator('#materialStyle').selectOption('action');
 await page.waitForFunction(()=>document.querySelector('#creatingOverlay')?.hidden===true,{timeout:120000});
 const selected=await page.evaluate(()=>({
   palette:document.getElementById('palette').value,
   colours:+document.getElementById('colourCount').value,
   pigments:window.AlgoArt.lastActionPaintingStats?.palette||[]
 }));
 assert.equal(selected.palette,'spectrum');
 assert(selected.colours>=8,'Action Painting must start with a broad colour rack');
 assert(new Set(selected.pigments).size>=8,'Action Painting must render eight distinct colours');
 await page.locator('#palette').evaluate(el=>{el.value='primary';el.dispatchEvent(new Event('change',{bubbles:true}))});
 await page.waitForFunction(()=>document.querySelector('#creatingOverlay')?.hidden===true,{timeout:120000});
 const primary=await page.evaluate(()=>window.AlgoArt.lastActionPaintingStats?.palette||[]);
 assert(new Set(primary).size>=8,'Primary-based painting must not repeat only three hues');
 console.log('PASS: Action Painting uses a diverse palette and explicit monochrome remains selectable');
}finally{await browser.close()}
