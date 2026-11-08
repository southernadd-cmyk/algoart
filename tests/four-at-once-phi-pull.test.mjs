// Four at once compares the *same* artwork at golden-section φ-pull values.
// Browser regression: no new seeds, no changed material/settings, four real renders.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const steps=[0,38.2,61.8,100];
const scenarios=[
  {name:'marker landscape',query:'?v=9&seed=PHI-COMPARISON-MARKER&mode=rects&phi=73&material=marker'},
  {name:'oil V8 portrait',query:'?v=9&seed=PHI-COMPARISON-OIL&mode=organic&fmt=portrait&phi=73&material=oil-v8'}
];
try{
 for(const scenario of scenarios){
  const context=await browser.newContext({viewport:{width:1320,height:900}});
  await context.addInitScript(()=>{
    localStorage.setItem('algoart-intro-seen','1');
    localStorage.setItem('algoart-inspector-desktop','open');
    localStorage.setItem('algoart-ethos-seen','1');
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(90000);
  try{
    await page.goto(new URL(scenario.query,base).href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true);
    const before=await page.evaluate(()=>{
      const A=window.AlgoArt;
      const main=document.getElementById('art');
      const d=main.getContext('2d').getImageData(0,0,main.width,main.height).data;
      let h=2166136261>>>0;
      for(let i=0;i<d.length;i+=103)h=Math.imul(h^d[i],16777619)>>>0;
      return {settings:A.readSettings(),version:A.rendererVersion,
        material:document.getElementById('materialStyle').value,
        dimensions:[A.W,A.H],hash:h,url:location.href};
    });
    await page.locator('#variations').click();
    await page.locator('#variationsOverlay').waitFor({state:'visible'});
    const comparison=await page.evaluate(()=>{
      const A=window.AlgoArt,main=document.getElementById('art');
      const d=main.getContext('2d').getImageData(0,0,main.width,main.height).data;
      let h=2166136261>>>0;
      for(let i=0;i<d.length;i+=103)h=Math.imul(h^d[i],16777619)>>>0;
      return {settings:A.readSettings(),version:A.rendererVersion,
        material:document.getElementById('materialStyle').value,
        dimensions:[A.W,A.H],hash:h,url:location.href,
        cards:[...document.querySelectorAll('.variation-card')].map(el=>({
          pull:Number(el.dataset.phiPull),
          text:el.querySelector('span').textContent,
          dimensions:[el.querySelector('canvas').width,el.querySelector('canvas').height],
          image:el.querySelector('canvas').toDataURL()
        }))};
    });
    assert.deepEqual(comparison.settings,before.settings,scenario.name+' comparison modified controls');
    assert.deepEqual(comparison.dimensions,before.dimensions,scenario.name+' comparison changed canvas dimensions');
    assert.equal(comparison.hash,before.hash,scenario.name+' comparison modified main image pixels');
    assert.equal(comparison.version,before.version,scenario.name+' comparison changed renderer version');
    assert.equal(comparison.material,before.material,scenario.name+' comparison changed material');
    assert.equal(comparison.url,before.url,scenario.name+' comparison modified artwork URL');
    assert.deepEqual(comparison.cards.map(x=>x.pull),steps,scenario.name+' incorrect φ values');
    assert(comparison.cards.every(x=>x.dimensions.every(v=>v>0)),scenario.name+' blank cards');
    assert(comparison.cards.every(x=>x.text.includes(x.pull+'%')),scenario.name+' labels missing');
    assert(new Set(comparison.cards.map(x=>x.image)).size>1,scenario.name+' identical canvases');
    assert.equal(await page.locator('#shuffleVariations').count(),0);
    await page.locator('.variation-card').nth(2).click();
    await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true&&
      Number(window.AlgoArt.readSettings().phiStrength)===61.8);
    const after=await page.evaluate(()=>({
      settings:window.AlgoArt.readSettings(),
      material:document.getElementById('materialStyle').value,
      version:window.AlgoArt.rendererVersion,
      selectedURL:location.href,
      overlayHidden:document.getElementById('variationsOverlay').hidden
    }));
    assert.deepEqual(after.settings,{...before.settings,phiStrength:61.8},
      scenario.name+' selecting preview changed another setting');
    assert.equal(after.material,before.material);
    assert.equal(after.version,before.version);
    assert.equal(after.overlayHidden,true);
    assert.equal(new URL(after.selectedURL).searchParams.get('phi'),'61.8');
    assert.deepEqual(errors,[],scenario.name+' page errors');
    console.log('PASS '+scenario.name+': same-seed φ pull comparisons and selection');
  }finally{await context.close()}
 }
}finally{await browser.close()}
