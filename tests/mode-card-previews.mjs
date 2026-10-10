// Every Compose → Series thumbnail must be the exact low-resolution
// rendering of the state selected by clicking that system card.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.PREVIEW_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1000}});
const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'];
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
await page.addInitScript(()=>{
  localStorage.setItem('algoart-intro-seen','1');
  localStorage.setItem('algoart-tab','composition');
  localStorage.setItem('algoart-inspector-desktop','open');
});

// Compare *pixel data*, not a similarity threshold. Full-resolution
// artwork is generated independently by the same seeded generator.
const snapshot=async()=>page.evaluate(()=>{
  const cards=[...document.querySelectorAll('.mode-card')];
  return cards.map(card=>{
    const c=card.querySelector('canvas'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let hash=2166136261;
    for(let i=0;i<pixels.length;i++)hash=Math.imul(hash^pixels[i],16777619);
    return{mode:card.dataset.mode,width:c.width,height:c.height,hash:hash>>>0,alpha:pixels[3]};
  });
});

for(const orientation of ['landscape','portrait']){
  const url=new URL(base);
  url.searchParams.set('v','7');
  url.searchParams.set('mode','field');
  url.searchParams.set('seed','MODE-THUMB-'+orientation.toUpperCase());
  if(orientation==='portrait')url.searchParams.set('fmt','portrait');
  url.searchParams.set('el','43');
  url.searchParams.set('cx','89');
  url.searchParams.set('od','4');
  url.searchParams.set('grain','15');

  await page.goto(url.toString(),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(({orientation,count})=>{
    const canvases=[...document.querySelectorAll('.mode-card canvas')];
    return canvases.length===count&&canvases.every(c=>{
      if(c.width!==(orientation==='portrait'?100:140)||c.height!==(orientation==='portrait'?140:100))return false;
      return c.getContext('2d').getImageData(0,0,1,1).data[3]===255;
    });
  },{orientation,count:modes.length},{timeout:90000});

  const initial=await snapshot();
  assert.deepEqual(initial.map(c=>c.mode),modes);
  assert.ok(initial.every(c=>c.alpha===255),'A thumbnail has not finished rendering');
  const seed='MODE-THUMB-'+orientation.toUpperCase();
  const initialSettings=await page.evaluate(()=>window.AlgoArt.readSettings());
  assert.equal(initialSettings.seed,seed);
  const originalMeta=await page.evaluate(()=>JSON.stringify(window.AlgoArt.lastRenderMeta));
  assert.ok(originalMeta.includes('strategy'),'Selected artwork metadata is missing');

  for(const mode of modes){
    // Clicking the system card must not change seed, pen, elements,
    // bend, overdraw, texture or any other setting except mode.
    await page.locator('.mode-card[data-mode="'+mode+'"]').click();
    const match=await page.evaluate(mode=>{
      const A=window.AlgoArt,s=A.readSettings();
      const card=document.querySelector('.mode-card[data-mode="'+mode+'"] canvas');
      const main=document.querySelector('#art');
      const tmp=document.createElement('canvas');
      const selectedMeta=A.lastRenderMeta,selectedW=A.W,selectedH=A.H;
      const ver=A.rendererVersion;
      A.render(tmp,s,.1,false);
      const a=card.getContext('2d').getImageData(0,0,card.width,card.height).data;
      const b=tmp.getContext('2d').getImageData(0,0,tmp.width,tmp.height).data;
      let mismatched=0;
      for(let i=0;i<a.length;i++)if(a[i]!==b[i])mismatched++;
      A.lastRenderMeta=selectedMeta;A.W=selectedW;A.H=selectedH;
      return{
        mismatched,dimensions:[card.width,card.height,tmp.width,tmp.height],
        mode:s.mode,seed:s.seed,settings:s,renderer:ver,
        mainSize:[main.width,main.height],mainMeta:!!selectedMeta&&!!selectedMeta.strategy,
        urlMode:new URLSearchParams(location.search).get('mode'),
        cardPressed:document.querySelector('.mode-card[data-mode="'+mode+'"]').getAttribute('aria-pressed')
      };
    },mode);
    assert.equal(match.mismatched,0,orientation+' '+mode+' thumbnail differs from exact selected render');
    assert.deepEqual(match.dimensions,[orientation==='portrait'?100:140,orientation==='portrait'?140:100,orientation==='portrait'?100:140,orientation==='portrait'?140:100]);
    assert.equal(match.renderer,7);
    assert.equal(match.mode,mode);
    assert.equal(match.seed,seed);
    assert.equal(match.cardPressed,'true');
    assert.equal(match.urlMode,mode);
    assert.ok(match.mainMeta,'Missing full-render metadata');
    assert.deepEqual(match.mainSize,orientation==='portrait'?[1000,1400]:[1400,1000]);
    assert.deepEqual(Object.assign({},match.settings,{mode:'field'}),initialSettings,'System click changed other parameters');
  }
  const afterClicks=await snapshot();
  // Cache excludes the active system. Switching cards must not change
  // any other candidate thumbnails and must not trigger repaint surprises.
  assert.deepEqual(afterClicks.map(c=>c.hash),initial.map(c=>c.hash),'Switching systems changed unchanged candidate previews');

  // Changing the seed must refresh every candidate automatically.
  const first=await page.locator('.mode-card[data-mode="field"] canvas').evaluate(c=>c.toDataURL());
  await page.locator('#seed').fill('CHANGED-'+orientation.toUpperCase());
  await page.locator('#seed').dispatchEvent('change');
  await page.waitForFunction(before=>document.querySelector('.mode-card[data-mode="field"] canvas').toDataURL()!==before,first,{timeout:90000});
  assert.equal(await page.evaluate(()=>window.AlgoArt.readSettings().seed),'CHANGED-'+orientation.toUpperCase());

  // In particular, the thumbnail is not clamped to 28 elements / 72 bend /
  // 2 overdraw or grain 0 as it was before the fix.
  const state=await page.evaluate(()=>window.AlgoArt.readSettings());
  assert.equal(state.elements,43);
  assert.equal(state.complexity,89);
  assert.equal(state.overdraw,4);
  assert.equal(state.grain,15);

  console.log('PASS: '+orientation+' eight exact clickable system thumbnails, preserved settings, and live seed refresh.');
}
assert.equal(errors.length,0,'Browser script errors: '+errors.join(' | '));
await browser.close();
