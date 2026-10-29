import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('phi-tower-results/hologram',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const [name,path] of [['live','gallery/visit/'],['test','test/virtual-gallery/full-engine.html']]){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/'+path+'?debug',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__phiDeskHologram,{timeout:180000});
  await page.waitForFunction(()=>!document.getElementById('enter').disabled,{timeout:180000});
  const data=await page.evaluate(()=>({hologram:window.__phiDeskHologram,exterior:window.__phiTowerExterior}));
  assert.equal(data.hologram.floorCount,data.exterior.otherFloors+1);
  assert.ok(data.hologram.boxes>100);assert.ok(data.hologram.drawCalls<=8);
  assert.equal(data.hologram.source,'actual tower shell');
  await writeFile('phi-tower-results/hologram/'+name+'.json',JSON.stringify(data,null,2));
  console.log(name,JSON.stringify(data));
  // Software GPU readback can hang on hosted runners. Verify the real loaded
  // tower and its hologram without making image capture a release dependency.
  assert.deepEqual(errors,[]);
  await page.close();
 }
}finally{await browser.close();}
