// Eight fresh, genuinely random V2d studies — ONE from each V8 engine.
// This is a screenshot/artwork sampler, not a production publishing path.
// Each image and its full seed/settings are saved for deterministic reproduction.
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const output='watercolour-eight-random';
await mkdir(output,{recursive:true});

const engines=[
  {mode:'field',name:'Orbital Studies',orientation:'landscape'},
  {mode:'spiral',name:'Golden Trajectories',orientation:'portrait'},
  {mode:'rects',name:'Recursive Divisions',orientation:'landscape'},
  {mode:'burst',name:'Radiant Systems',orientation:'portrait'},
  {mode:'network',name:'Connected Fields',orientation:'landscape'},
  {mode:'scribble',name:'Automatic Marks',orientation:'portrait'},
  {mode:'organic',name:'Growth Systems',orientation:'landscape'},
  {mode:'geometric',name:'Constructed Forms',orientation:'portrait'}
];

// One random seed per composition; PR reruns generate new art. All sampled
// parameters are written to manifest.json so the images remain reproducible.
function randInt(low,high){return low+randomBytes(4).readUInt32BE(0)%(high-low+1)}
const palettes=['golden','earth','warm','mono'];
const scenarios=engines.map((engine,index)=>({
  ...engine,
  seed:'WC-V2D-'+engine.mode.toUpperCase()+'-'+randomBytes(5).toString('hex').toUpperCase(),
  elements:randInt(18,42),
  density:randInt(43,73),
  complexity:randInt(43,81),
  negativeSpace:randInt(41,69),
  phiStrength:randInt(84,99),
  recursion:randInt(3,5),
  spiralInfluence:randInt(38,78),
  goldenAngle:randInt(82,98),
  nesting:randInt(37,70),
  curveBias:randInt(38,88),
  shapeAmount:randInt(42,77),
  overlap:randInt(41,77),
  rotation:randInt(18,88),
  palette:palettes[index%palettes.length],
  colourCount:randInt(3,5),
  saturation:randInt(77,97),
  brightness:randInt(52,76)
}));
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  page.setDefaultTimeout(180000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('experiments/watercolour-wet-edge-preview.html',root).href,
    {waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>window.__previewReady===true||!!window.__previewError,
    null,{timeout:180000});
  const firstError=await page.evaluate(()=>window.__previewError||'');
  if(firstError)throw new Error('Preview setup: '+firstError);
  const manifest=[];
  for(const [i,scenario] of scenarios.entries()){
    // Use the proven preview's original V8 composer and newest experimental
    // paper material. The global painter is always restored on exit.
    const result=await page.evaluate((scenario)=>{
      const A=window.AlgoArt,original=A.oilMaterial;
      const settings={...window.__currentPreviewSettings,...scenario,
        pen:'fine',paper:'#f5f0e6',grain:13};
      delete settings.name;
      const canvas=document.createElement('canvas');
      let meta;
      try{
        A.oilMaterial=A.watercolourMaterialExperiment;
        meta=A.renderOil(canvas,settings,1,false,6);
        return {
          data:canvas.toDataURL('image/png').split(',')[1],
          width:canvas.width,height:canvas.height,
          meta:{strategy:meta.strategy,voids:(meta.voids||[]).length},
          material:A.lastWatercolourExperimentStats,
          settings
        };
      }finally{A.oilMaterial=original;}
    },scenario);
    assert.equal(result.width,scenario.orientation==='portrait'?1000:1400);
    assert.equal(result.height,scenario.orientation==='portrait'?1400:1000);
    assert.equal(result.material.paper,'#f5f0e6');
    assert(result.material.chains>0,'Expected nonempty geometry: '+scenario.mode);
    const png=Buffer.from(result.data,'base64');
    assert(png.length>15000,'Unexpected blank or tiny png: '+scenario.mode);
    const filename=String(i+1).padStart(2,'0')+'-'+scenario.mode+'-'+scenario.orientation+'.png';
    await writeFile(output+'/'+filename,png);
    manifest.push({filename,name:scenario.name,...result.settings,
      width:result.width,height:result.height,pngBytes:png.length,
      geometry:result.meta,paperFlow:result.material.paperFlow});
    console.log('RENDERED',filename,png.length+' bytes',
      'seed='+scenario.seed,'paths='+result.material.chains);
  }
  assert.equal(manifest.length,8);
  assert.equal(new Set(manifest.map(x=>x.seed)).size,8);
  assert.equal(errors.length,0,'Browser errors: '+errors.join('; '));
  await writeFile(output+'/manifest.json',JSON.stringify({
    description:'8 unique random studies in experimental Watercolour V2d',
    material:'watercolour-v2d-paper-diffusion',rendererVersion:8,
    revision:'experimental branch only; no production changes',
    samples:manifest
  },null,2));
  console.log('PASS: 8 new independent, reproducible V2d watercolour PNGs');
}finally{
  await browser.close();
}
