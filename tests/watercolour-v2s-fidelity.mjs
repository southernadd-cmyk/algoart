// V2S isolated visual regression, never changes main or gallery.
// Seeds from user's 14 Oct 2026 comparisons; original PNGs contain no
// serialized slider controls, so this is a *matched-default-controls* comparison,
// NOT a false claim to reproduce their exact historical PNG pixels.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const dir='watercolour-v2r-v2s-matched';
const cases=[
  {mode:'spiral',seed:'BDS8W-3918',label:'Spiral: retain dry brush and open rhythms'},
  {mode:'rects',seed:'LEH92-6799',label:'Rects: preserve negative space and subdivision hierarchy'},
  {mode:'field',seed:'3XHXQ-4616',label:'Field: recover source pink gestures and palette'}
];
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try{
  const page=await browser.newPage({viewport:{width:1400,height:920}});
  page.setDefaultTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [i,c] of cases.entries()){
    const url=new URL(root);
    url.search='?v=9&seed='+encodeURIComponent(c.seed)+'&mode='+c.mode+
      '&material=watercolour-v2r&paper=%23f5f0e6';
    await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(seed=>
      document.querySelector('#statsText')?.textContent.includes(seed),
      c.seed,{timeout:180000});
    await page.addScriptTag({url:new URL('experiments/watercolour-v2s-fidelity.js',root).href});
    const sample=await page.evaluate(()=>{
      const A=window.AlgoArt;
      const settings={...A.readSettings()},previousMaterial=A.oilMaterial;
      const render=(revision,flag)=>{
        A.watercolourV2sOptions.fidelity=flag;
        const canvas=document.createElement('canvas'),t0=performance.now();
        if(revision==='v2r')A.renderWatercolourV2R(canvas,settings,1,false);
        else A.renderWatercolourV2S(canvas,settings,1,false);
        return {image:canvas.toDataURL('image/png').split(',')[1],
          stats:JSON.parse(JSON.stringify(A.lastWatercolourExperimentStats)),
          width:canvas.width,height:canvas.height,
          ms:Math.round(performance.now()-t0)};
      };
      try{
        const v2r=render('v2r',false);
        const fallback=render('v2s',false);
        const v2s=render('v2s',true);
        const repeat=render('v2s',true);
        return {settings,v2r,fallback,v2s,
          repeatEqual:v2s.image===repeat.image,
          restored:A.oilMaterial===previousMaterial,
          captureCleared:A.watercolourV2sAllChains===null,
          flagCleared:A.watercolourV2sActive===false};
      }finally{A.watercolourV2sOptions.fidelity=true;}
    });
    assert(sample.restored&&sample.captureCleared&&sample.flagCleared,
      'Renderer left global state behind');
    assert.equal(sample.v2r.image,sample.fallback.image,
      'V2S disabled must reproduce released V2R pixels identically');
    assert.equal(sample.repeatEqual,true,'V2S not seed-deterministic');
    const changed=sample.v2r.image!==sample.v2s.image;
    console.log('V2S DIAGNOSTICS',c.mode,JSON.stringify({changed,
      sourceHueMatches:sample.v2s.stats.sourceHueMatches,
      preservedLines:sample.v2s.stats.preservedLines,
      washStates:sample.v2s.stats.washStates}));
    // A monochrome Rects piece is allowed to remain byte-identical:
    // retaining successful geometric work is a goal, not a failure.
    if(c.mode!=='rects')assert(changed,
      'Source fidelity should visibly affect '+c.mode);
    assert.deepEqual(sample.v2r.stats.compositionPresentation,
      sample.v2s.stats.compositionPresentation,
      'V2S must not change source frame or hierarchy');
    assert.equal(sample.v2r.stats.paper,'#f5f0e6');
    assert.deepEqual(sample.v2r.stats.washStates,sample.v2s.stats.washStates);
    assert.equal(sample.v2s.stats.v2sFidelity,true);
    if(c.mode!=='rects'){
      assert(sample.v2s.stats.sourceHueMatches>10,
        'Original source colour was not captured');
      assert(sample.v2s.stats.preservedLines.rendered>10,
        'Original open strokes were not recovered');
    }
    assert(sample.v2s.stats.preservedLines.available>=
      sample.v2r.stats.chains,
      'Source chain collection shrank');
    assert(sample.v2s.stats.paperFlow.conservationError<.00002);
    assert.equal(sample.v2r.width,sample.v2s.width);
    assert.equal(sample.v2r.height,sample.v2s.height);
    assert.equal(errors.length,0,errors.join(' | '));
    const stem=String(i+1).padStart(2,'0')+'-'+c.mode;
    const files=[];
    for(const name of ['v2r','v2s']){
      const png=Buffer.from(sample[name].image,'base64');
      assert(png.length>20000,'PNG appears blank');
      const file=stem+'-'+name+'.png';
      await writeFile(dir+'/'+file,png);
      files.push({name,file,bytes:png.length});
    }
    results.push({mode:c.mode,seed:c.seed,label:c.label,settings:sample.settings,
      files,renderMs:{v2r:sample.v2r.ms,v2s:sample.v2s.ms},
      visiblyChanged:changed,sourceColourCount:sample.v2s.stats.sourceHueMatches,
      recoveredLines:sample.v2s.stats.preservedLines,
      v2rFlow:sample.v2r.stats.paperFlow,
      v2sFlow:sample.v2s.stats.paperFlow});
    console.log('PASS V2S',c.mode,c.seed,
      'source hue',sample.v2s.stats.sourceHueMatches,
      'open lines',sample.v2s.stats.preservedLines.rendered,
      'render ms',sample.v2r.ms,sample.v2s.ms);
  }
  await writeFile(dir+'/manifest.json',JSON.stringify({
    status:'ISOLATED experiment, not released',
    reference:'Released Watercolour V2R (unchanged)',
    qualification:'Original user-provided PNGs have no stored slider parameters; these compare each same seed and identical editor defaults in both materials, not exact archived screenshot settings.',
    tests:'Pixel-exact V2R fallback, V2S seed replay, invariant composition presentation, pigment conservation and recovered source hue/lines.',
    studies:results
  },null,2));
  console.log('PASS all '+results.length+' matched V2R/V2S studies');
}finally{await browser.close();}
