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
 const tower=await page.evaluate(()=>window.__phiTowerExterior);
 assert.ok(tower?.otherFloors>0,'Missing exterior tower floors');
 assert.ok(tower.wallMeshes>tower.otherFloors,'Missing external wall geometry');
 assert.ok(await page.evaluate(()=>window.__phiReception?.desk&&window.__phiReception?.information),'Missing ground-floor reception');
 assert.equal(await page.evaluate(()=>window.__galleryStartupError),'');
 assert.equal(errors.length,0,errors.join('; '));
 assert.equal(await page.locator('#world').count(),1);
 // Physical lift ride: the cabin and player must move in world space.
 await page.locator('#enter').click();
 await page.locator('#openLift').dispatchEvent('click');
 assert.equal(await page.locator('#lift').isVisible(),true,'Lift calendar did not open');
 const destination=page.locator('#liftDays button.lift-available:not(.lift-current)').last();
 await destination.dispatchEvent('click');
 await page.waitForFunction(()=>window.__phiLiftRide?.status==='moving',{timeout:15000});
 const positions=await page.evaluate(()=>window.__phiLiftRide);
 assert.ok(Math.abs(positions.to-positions.from)>1,'Lift destination did not change');
 await page.waitForFunction(()=>window.__phiLiftRide?.status==='arrived',{timeout:90000});
 await page.waitForFunction(()=>document.querySelector('#lift')?.hidden &&
   !document.querySelector('#liftArrival')?.hidden,{timeout:90000});
 assert.equal(await page.locator('#lift').isVisible(),false,
   'Calendar unexpectedly reopened on arrival');
 assert.equal(await page.locator('#liftAnimation').isVisible(),false,
   'Old cutscene appeared during physical lift travel');

 console.log('Full-engine source imported without page errors');
}finally{await browser.close();}
