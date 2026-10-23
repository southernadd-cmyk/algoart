// Another must vary the artwork, never any output/plotter preferences.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1280,height:820}});
 await page.addInitScript(()=>{
  localStorage.setItem('algoart-intro-seen','1');
  localStorage.setItem('algoart-ethos-seen','1');
  localStorage.setItem('algoart-inspector-desktop','open');
 });
 await page.goto('http://127.0.0.1:4173/?v=8&seed=ANOTHER-PLOTTER-001&mode=rects');
 await page.waitForFunction(()=>document.getElementById('seed')?.value==='ANOTHER-PLOTTER-001'&&
  document.getElementById('creatingOverlay')?.hidden===true&&
  document.getElementById('statsText')?.textContent.includes('Recursive Divisions'),
  null,{timeout:120000});
 await page.locator('#tab-export').click();
 await page.locator('#plotterPaper').selectOption('A3');
 await page.locator('#plotterGrouping').selectOption('pens');
 await page.locator('#exportScale').selectOption('3');
 const before=await page.evaluate(()=>({
  paper:document.getElementById('plotterPaper').value,
  grouping:document.getElementById('plotterGrouping').value,
  margin:document.getElementById('plotterMargin').value,
  png:document.getElementById('exportScale').value,
  orientation:document.getElementById('orientation').value,
  seed:document.getElementById('seed').value
 }));
 await page.locator('#randomise').click();
 await page.waitForFunction(seed=>document.getElementById('seed')?.value!==seed&&
  document.getElementById('creatingOverlay')?.hidden===true, before.seed,{timeout:180000});
 const after=await page.evaluate(()=>({
  paper:document.getElementById('plotterPaper').value,
  grouping:document.getElementById('plotterGrouping').value,
  margin:document.getElementById('plotterMargin').value,
  png:document.getElementById('exportScale').value,
  orientation:document.getElementById('orientation').value,
  seed:document.getElementById('seed').value
 }));
 assert.deepEqual({...after,seed:before.seed},before,'Another changed an export or canvas preference');
 assert.notEqual(after.seed,before.seed,'Another must create a new artwork seed');
 console.log('PASS Another varies artwork while preserving export paper, grouping, margin, PNG size and orientation');
}finally{await browser.close()}
