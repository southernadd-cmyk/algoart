// Full browser regression: social links must open the EXACT rendering in the editor.
// Run with local server: python3 -m http.server 8765 --bind 127.0.0.1
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.PREVIEW_URL||'http://127.0.0.1:8765/';
const day='2026-10-09';
const archive=JSON.parse(await fs.readFile(new URL('../gallery/'+day+'/meta.json',import.meta.url),'utf8'));
const items=[archive.entries.find(x=>x.orientation==='portrait'),archive.entries.find(x=>x.orientation==='landscape')];
assert.ok(items.every(Boolean),'Need both artwork orientations in the archive');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1380,height:940}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
const signature=()=>page.evaluate(()=>{
  const canvas=document.querySelector('#art');
  const pixels=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
  let hash=2166136261>>>0;
  for(let i=0;i<pixels.length;i+=71){hash=Math.imul(hash^pixels[i],16777619)>>>0;}
  return {width:canvas.width,height:canvas.height,hash,seed:document.querySelector('#seed').value,orientation:document.querySelector('#orientation').value};
});
try{
  for(const item of items){
    const short=new URL(base);short.searchParams.set('art',item.id);
    await page.goto(short.href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(seed=>new URLSearchParams(location.search).get('seed')===seed,item.seed,{timeout:20000});
    assert.equal(await page.locator('#introSplash').isHidden(),true,'Social artwork link must bypass intro overlay');
    const opened=new URL(page.url());
    assert.equal(opened.searchParams.has('art'),false,'Compact URL must expand into canonical editor settings');
    assert.equal(opened.searchParams.get('mode'),item.mode,'Editor mode not restored');
    assert.equal(opened.searchParams.get('fmt'),item.orientation==='portrait'?'portrait':null,'Wrong orientation');
    const expected=new URL(item.shareUrl);
    for(const [key,value] of expected.searchParams.entries())assert.equal(opened.searchParams.get(key),value,'Wrong canonical parameter '+key);
    const fromShort=await signature();
    const full=new URL(base);full.search=expected.search;
    await page.goto(full.href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(seed=>document.querySelector('#seed').value===seed,item.seed,{timeout:20000});
    const fromFull=await signature();
    assert.deepEqual(fromShort,fromFull,'Compact editor link does not reproduce original artwork pixels');
    assert.equal(fromShort.width,item.orientation==='portrait'?1000:1400);
    assert.equal(fromShort.height,item.orientation==='portrait'?1400:1000);
  }
  await page.goto(new URL(base).href,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#introSplash').isVisible(),true,'Normal homepage must keep first-visit introduction');
  await page.goto(new URL('gallery/'+day+'/',base).href,{waitUntil:'domcontentloaded'});
  await page.locator('.art-card[data-orientation="portrait"] img').first().waitFor();
  const frames=await page.evaluate(()=>{
    const metrics=selector=>{
      const img=document.querySelector(selector+' .art-image-link img');
      const box=img.getBoundingClientRect();
      return {height:box.height,width:box.width,ratio:box.width/box.height,fit:getComputedStyle(img).objectFit};
    };
    return {landscape:metrics('.art-card[data-orientation="landscape"]'),portrait:metrics('.art-card[data-orientation="portrait"]')};
  });
  assert.ok(Math.abs(frames.landscape.height-frames.portrait.height)<1,'Portrait gallery entry extends vertically below landscape');
  assert.ok(Math.abs(frames.portrait.ratio-1.4)<.02,'Portrait gallery image frame must match landscape frame');
  assert.equal(frames.portrait.fit,'contain','Portrait must be visible without cropping');
  if(errors.length)throw Error('Page errors: '+errors.join(' | '));
  console.log('PASS: both short social links restore the exact image/editor settings and canonical share URL; portrait and landscape gallery frames have equal heights.');
}finally{await browser.close()}
