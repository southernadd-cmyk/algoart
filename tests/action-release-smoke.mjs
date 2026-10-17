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
  assert.equal(new URL(item.shareUrl).searchParams.get('material'),'action-v2');
  assert.match(item.id,/^2026-10-18-AC[LP]01$/);
  assert.match(item.copy.instagram,/ACTION PAINTING V2/);
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
 await page.goto('http://127.0.0.1:4173/?seed=ACTION-COLOR-TEST&material=action-v2',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#creatingOverlay')?.hidden===true,{timeout:120000});
 // Use actual editor controls and verify the V2 renderer sees the exact count.
 for(const palette of ['spectrum','primary','cmyk','mono']){
  for(const count of [1,2,3,9,14]){
   await page.evaluate(({palette,count})=>{
    const p=document.getElementById('palette');
    p.value=palette;p.dispatchEvent(new Event('change',{bubbles:true}));
    const c=document.getElementById('colourCount');
    if(window.AlgoArt.setControlValue)window.AlgoArt.setControlValue(c,count);
    else c.value=String(count);
    c.dispatchEvent(new Event('change',{bubbles:true}));
   },{palette,count});
   await page.waitForFunction(({palette,count})=>{
    const stats=window.AlgoArt.lastActionPaintingStats;
    return document.getElementById('creatingOverlay')?.hidden===true &&
      document.getElementById('palette').value===palette &&
      +document.getElementById('colourCount').value===count &&
      stats?.palette?.length===count;
   },{palette,count},{timeout:120000});
   const actual=await page.evaluate(()=>window.AlgoArt.lastActionPaintingStats.palette);
   assert.equal(actual.length,count,palette+' must obey Colours slider='+count);
  }
 }
 // Changing material must not silently change the user's palette/count.
 await page.evaluate(()=>{
  const p=document.getElementById('palette'),c=document.getElementById('colourCount');
  p.value='primary';p.dispatchEvent(new Event('change',{bubbles:true}));
  if(window.AlgoArt.setControlValue)window.AlgoArt.setControlValue(c,3);
  else c.value='3';
  c.dispatchEvent(new Event('change',{bubbles:true}));
  const material=document.getElementById('materialStyle');
  material.value='marker';material.dispatchEvent(new Event('change',{bubbles:true}));
  material.value='action';material.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.waitForFunction(()=>document.querySelector('#creatingOverlay')?.hidden===true,{timeout:120000});
 const preserved=await page.evaluate(()=>({
  palette:document.getElementById('palette').value,
  count:+document.getElementById('colourCount').value
 }));
 assert.deepEqual(preserved,{palette:'primary',count:3});
 // Archived V1 links retain their previous minimum of eight pigments, without
 // silently being migrated to the new V2 interpretation of the same controls.
 await page.goto('http://127.0.0.1:4173/?v=9&seed=ACTION-ARCHIVE&mode=field&pal=primary&cols=3&material=action-v1');
 await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true&&
  window.AlgoArt.lastActionPaintingStats?.palette?.length===8,{timeout:120000});
 assert.equal(new URL(page.url()).searchParams.get('material'),'action-v1');
 const old=await page.evaluate(()=>window.AlgoArt.lastActionPaintingStats.palette);
 assert.equal(old.length,8,'Archived V1 image must keep the original eight-pigment minimum');
 await page.goto('http://127.0.0.1:4173/?v=9&seed=ACTION-ARCHIVE&mode=field&pal=primary&cols=3&material=action-v2');
 await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true&&
  window.AlgoArt.lastActionPaintingStats?.palette?.length===3,{timeout:120000});
 assert.equal(new URL(page.url()).searchParams.get('material'),'action-v2');
 const modern=await page.evaluate(()=>window.AlgoArt.lastActionPaintingStats.palette);
 assert.equal(modern.length,3,'V2 must honour the slider for the identical seed');

 console.log('PASS: Action Painting honours the exact Colours slider and preserves material choices');
}finally{await browser.close()}
