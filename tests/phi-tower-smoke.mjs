import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('phi-tower-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/test/virtual-gallery/phi-tower.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#floors button').length>=3,{timeout:90000});
 assert.doesNotMatch(await page.locator('#status').textContent(),/failed/i);
 await page.locator('#tower').screenshot({path:'phi-tower-results/overview.png'});
 await page.locator('#walkTower').click();
 assert.equal(await page.locator('#walkTower').textContent(),'Orbit tower');
 const first=await page.locator('#status').textContent();
 await page.locator('#liftDown').click();
 await page.waitForTimeout(900);
 assert.equal(errors.length,0,'Uncaught errors: '+errors.join('; '));
 await page.locator('#tower').screenshot({path:'phi-tower-results/walk.png'});
 console.log({floors:await page.locator('#floors button').count(),first,after:await page.locator('#status').textContent()});
} finally {await browser.close();}
