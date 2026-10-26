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
 const phi=await page.evaluate(()=>window.__phiFullEngine);
 assert.ok(phi,'Full engine did not construct phi geometry');
 assert.ok(phi.wallCount>0&&phi.roomCount>0,'Missing phi architecture');
 assert.equal(phi.artworks,phi.paintings+phi.sculptures,'Phi curator dropped art');
 assert.equal(phi.unplaced,0,'Unplaced artworks');
 const plaza=await page.evaluate(()=>window.__phiPlaza);
 assert.ok(plaza,'Ground floor plaza was not constructed');
 assert.equal(plaza.monumentCount,2);
 assert.equal(plaza.benchCount,6);
 assert.equal(await page.evaluate(()=>window.__galleryStartupError),'');
 assert.equal(errors.length,0,errors.join('; '));
 assert.equal(await page.locator('#world').count(),1);
 console.log('Full-engine source imported without page errors');
}finally{await browser.close();}
