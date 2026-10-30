// ALGO/ART Oil Paint v1: end-to-end Reveal, interactive metadata,
// editor parity and material compatibility. Real Chrome drawing, no mocks.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1540,height:1040}});
 await page.addInitScript(()=>localStorage.setItem('algoart-inspector-desktop','open'));
page.setDefaultTimeout(90000);
const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
try{
 const modes=['field','spiral','rects','burst','network',
   'organic','geometric','scribble'];
 await page.goto(origin+'?v=9&seed=V5Q-OIL-D7ADDCCC68&mode=spiral&material=oil-v1',
   {waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>/oil/i.test(document.querySelector('#statsText')?.textContent||''));
 const meta=await page.evaluate(()=>{
  const A=window.AlgoArt,m=A.lastRenderMeta;
  return{type:m?.guide?.type,voids:m?.voids?.length,
    strategy:m?.strategy,focal:m?.guide?.centres?.[0]};
 });
 assert.equal(meta.type,'spiral','Oil should expose the real V8 spiral guide');
 assert(meta.strategy,'Oil must report the true original strategy');
 assert.match(await page.locator('#descriptionLong').textContent(),
   /spiral|trajectory|composition/i);
 const before=await page.locator('#canvas').count(); // canonical id resolved below
 const ui=await page.evaluate(()=>{
   const button=document.querySelector('#geometry');
   const canvas=document.querySelector('.canvas-wrap canvas');
   return {button:button?.textContent,canvasId:canvas?.id,
      hasGuide:!!window.AlgoArt.lastRenderMeta?.guide};
 });
 assert(ui.hasGuide,'Oil lost source guide in app after initial rendering');
 const materialControls=await page.evaluate(()=>({
   note:document.querySelector('#materialControlsNote')?.textContent,
   help:document.querySelector('#control-help-pen')?.textContent,
   profile:document.querySelector('#pen option')?.textContent
 }));
 assert.match(materialControls.note,/Oil Paint v1/);
 assert.match(materialControls.help,/loaded bristle|Oil Paint v1/i);
 assert.doesNotMatch(materialControls.profile||'',/Highlighter/);
 const canvas=page.locator('.canvas-wrap canvas').first();
 const initial=await canvas.evaluate(el=>el.toDataURL());
 await page.locator('#geometry').click();
 await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true,{timeout:180000});
 assert.match(await page.locator('#geometry').textContent(),/Hide φ/);
 const revealed=await canvas.evaluate(el=>el.toDataURL());
 assert.notEqual(revealed,initial,'Reveal did not paint anything over Oil');
 // Interactive hover target comes from true source guide, not inferred.
 const hit=await page.evaluate(()=>{
   const guide=window.AlgoArt.lastRenderMeta?.guide;
   const rect=document.querySelector('.canvas-wrap canvas').getBoundingClientRect();
   const target=guide?.centres?.[0];
   if(!target)return null;
   return{x:rect.left+target.x/1400*rect.width,
          y:rect.top+target.y/1000*rect.height};
 });
 assert(hit,'Missing Oil spiral centre for pointer reveal test');
 await page.mouse.move(hit.x,hit.y);
 assert.equal(await page.locator('#revealTooltip').getAttribute('hidden'),
   null,'Source-derived Oil hover tooltip did not appear');
 assert.match(await page.locator('#revealTooltipTitle').textContent(),/Spiral hub/);
 await page.locator('#geometry').click();
 await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true,{timeout:180000});
 assert.equal(await canvas.evaluate(el=>el.toDataURL()),initial,
   'Hiding Reveal must recover the exact Oil painting');
 const result=await page.evaluate(async all=>{
   const A=window.AlgoArt,base=A.readSettings(),
     make=(fn,s)=>{const c=document.createElement('canvas');
       const meta=fn(c,s,.21,false);return{c,meta,img:c.toDataURL()}};
   const output=[];
   for(const [i,mode] of all.entries()){
      const s={...base,mode,orientation:i%2?'portrait':'landscape',
        seed:'OIL-REVEAL-PARITY-'+mode};
      const first=make(A.renderOilPaintV1,s);
      const second=make(A.renderOilPaintV1,s);
      const visible=document.createElement('canvas');
      const reveal=A.renderOilPaintV1(visible,s,.21,true);
      const m=first.meta;
      if(!m.guide)throw Error('Missing metadata for mode '+mode);
      output.push({mode,guide:m.guide?.type,
        voidCount:m.voids?.length,nonEmpty:m.strategy?.length>0,
        repeats:first.img===second.img,
        revealChanged:first.img!==visible.toDataURL(),
        dims:[first.c.width,first.c.height],
        overlayGuide:reveal.guide?.type});
   }
   return output;
 },modes);
 for(const v of result){
   assert(v.guide,'No source guide for '+v.mode);
   assert(v.nonEmpty,'No source strategy for '+v.mode);
   assert(v.repeats,'Oil no longer deterministic in '+v.mode);
   assert(v.revealChanged,'Reveal missing for '+v.mode);
   assert.equal(v.overlayGuide,v.guide,
      'Reveal guide diverges from Oil source guide '+v.mode);
 }
 // Check release material URL, switch behaviour, and existing renderers.
 assert.match(page.url(),/material=oil-v1/);
 await page.locator('#materialStyle').selectOption('tissue');
 await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true,{timeout:180000});
 assert.equal(await page.locator('#materialStyle').inputValue(),'tissue');
 assert.match(page.url(),/tissue=7/);
 await page.locator('#materialStyle').selectOption('watercolour');
 await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true,{timeout:180000});
 assert.equal(await page.locator('#materialStyle').inputValue(),'watercolour');
 assert.match(page.url(),/material=watercolour-v2s/);
 await page.locator('#materialStyle').selectOption('marker');
 await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true,{timeout:180000});
 assert.equal(await page.locator('#materialStyle').inputValue(),'marker');
 await page.locator('#materialStyle').selectOption('oil');
 await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true,{timeout:180000});
 assert.equal(await page.locator('#materialStyle').inputValue(),'oil');
 assert.match(page.url(),/material=oil-v7/); // New Oil selections use V7; explicit V1–V6 links remain historical.
 // Persist Oil across randomise; any seed may have no *broad* fields
 // but Reveal and metadata must still work for those valid compositions.
 await page.locator('#randomise').count(); // no-op for older UI ids
 const randomized=await page.evaluate(()=>{
   const el=[...document.querySelectorAll('button')]
     .find(e=>/randomise/i.test(e.textContent||''));
   if(!el)return null;
   el.click();
   return {material:document.querySelector('#materialStyle').value,
     metadata:!!window.AlgoArt.lastRenderMeta?.guide};
 });
 if(randomized){
   assert.equal(randomized.material,'oil');
   assert.equal(randomized.metadata,true);
 }
 assert.deepEqual(errors,[],'Unexpected page errors across Oil/legacy UI');
 console.log('PASS Oil v1: Reveal visible and reversible; Spiral hover; metadata on all eight engines, determinism, material URLs & Randomise',JSON.stringify({meta,result,randomized}));
}finally{await browser.close()}

