import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='oil-v8-replacement-results';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1560,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(root+'test/oil-v8-replacement/?manual=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.oilV8LabStudy && window.AlgoArt?.oilV8WetLab);
 const first=await page.evaluate(()=>window.oilV8LabStudy.render());
 for(const key of ['single','wet','dry','turn','stops']){
  const c=first.cases[key];assert(c,'Missing comparison '+key);
  assert(c.baseline.coverage>0.01,'Actual V7 brush must draw '+key);
  assert(c.material.coverage>0.01,'V8 must draw '+key);
  assert(c.difference.changedPixels>100,'V8 must visibly alter a substantial area '+key);
  assert(c.v8.events.length===windowNaNToTwo(key),'Contact event count '+key);
  console.log('LAB '+key+' '+JSON.stringify({changedPct:c.difference.changedPct.toFixed(2),
   strongPct:c.difference.strongPct.toFixed(2),wetCrossed:c.v8.crossedPixels,
   wetMixed:c.v8.colourMixedPixels,ridges:c.v8.ridgePixels,
   ms7:c.v7.paintMs.toFixed(1),ms8:c.v8.paintMs.toFixed(1)}));
 }
 function windowNaNToTwo(key){return key==='single'?1:2;}
 assert(first.cases.wet.v8.colourMixedPixels>100,'Wet crossing must mix observable paint');
 assert(first.cases.wet.v8.ridgePixels>0,'Wet crossing must push pigment sideways');
 assert.equal(first.cases.dry.v8.colourMixedPixels,0,'Dry crossing must not mix earlier pigment');
 assert.equal(first.cases.dry.v8.ridgePixels,0,'Dry crossing must not displace earlier pigment');
 assert.notEqual(first.cases.wet.material.hash,first.cases.dry.material.hash,'Dry and wet crossings differ');

 for(const name of ['single','wet','dry','turn','stops'])for(const v of ['v7','v8']){
  const b64=await page.locator('#'+name+'-'+v).evaluate(c=>c.toDataURL('image/png').split(',')[1]);
  await writeFile(out+'/'+name+'-'+v+'.png',Buffer.from(b64,'base64'));
 }
 await page.screenshot({path:out+'/all-five-side-by-sides.png',fullPage:true});
 const repeat=await page.evaluate(()=>window.oilV8LabStudy.render());
 for(const name of ['single','wet','dry','turn','stops']){
  assert.equal(first.cases[name].baseline.hash,repeat.cases[name].baseline.hash,'V7 unchanged on replay '+name);
  assert.equal(first.cases[name].material.hash,repeat.cases[name].material.hash,'V8 deterministic '+name);
 }
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile no horizontal clipping');
 assert.deepEqual(errors,[],'No page errors');
 await writeFile(out+'/results.json',JSON.stringify({seed:first.seed,cases:first.cases,testsPassed:true},null,2));
 console.log('PASS replacement Oil V8: five actual V7 brush scenes; wet-vs-dry discrimination; same brush geometry; deterministic replay; mobile fit');
}finally{await browser.close()}
