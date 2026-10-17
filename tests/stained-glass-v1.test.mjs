import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
await mkdir('stained-glass-results',{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:1360,height:1050},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('experiments/stained-glass-v1.html',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('article canvas[data-ready="true"]').length===4,{timeout:180000});
 const first=await page.evaluate(()=>{
  const cards=[...document.querySelectorAll('article')];
  return cards.map(card=>{
   const canvas=card.querySelector('canvas'),rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   let hash=2166136261,nonBlank=0;
   for(let i=0;i<rgba.length;i+=4){
    for(let k=0;k<4;k++)hash=Math.imul(hash^rgba[i+k],16777619);
    if(rgba[i]!==19||rgba[i+1]!==19||rgba[i+2]!==17)nonBlank++;
   }
   return {mode:card.querySelector('h2').textContent,hash:hash>>>0,
    nonBlank,area:canvas.width*canvas.height,description:card.querySelector('p').textContent};
  });
 });
 assert.equal(first.length,4);
 for(const item of first){
  assert(item.area>300000);
  assert(item.nonBlank>item.area*.5,'Mostly empty canvas: '+item.mode);
  assert.match(item.description,/original paths → \d+ glass panes/);
  assert.match(item.description,/shared lead seams/);
  assert.match(item.description,/[1-9]\\d* engine lead paths/,'Original engine geometry must form glass leadwork');
 }
 await page.screenshot({path:'stained-glass-results/gallery.png',fullPage:true});
 await page.locator('#render').click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='Four studies complete',{timeout:180000});
 const second=await page.evaluate(()=>[...document.querySelectorAll('article canvas')].map(canvas=>{
  const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let hash=2166136261;for(const v of rgba)hash=Math.imul(hash^v,16777619);
  return hash>>>0;
 }));
 assert.deepEqual(second,first.map(x=>x.hash),'V1 must be pixel-deterministic');
 assert.deepEqual(errors,[],'Browser errors');
 console.log('STAINED_GLASS_V1_PASS '+JSON.stringify(first));
}finally{await browser.close()}
