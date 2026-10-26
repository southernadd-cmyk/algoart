import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1365,height:850}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/test/virtual-gallery/full-engine.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled || !document.querySelector('#error')?.hidden || window.__galleryStartupError,{timeout:90000});
 assert.equal(await page.locator('#error').isVisible(),false,'Gallery startup error visible');
 assert.equal(await page.locator('#enter').isEnabled(),true,'Gallery did not finish preparing');
 assert.equal(await page.evaluate(()=>window.__galleryStartupError),'');
 assert.equal(errors.length,0,errors.join('; '));
 assert.equal(await page.locator('#world').count(),1);
 console.log('Full-engine source imported without page errors');
}finally{await browser.close();}
