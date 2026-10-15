// Eight REAL, full native-size ALGO/ART artworks from four material engines.
// Random seeds are generated ONCE per run and recorded in manifest. No
// comparison panels, artificial style transfers, image-generation models.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const dir='v5e-results/v5q-gallery';
await mkdir(dir,{recursive:true});
const materials=['marker','watercolour','oil','tissue'];
const modes=[['organic','spiral'],['geometric','organic'],
             ['spiral','geometric'],['organic','spiral']];
const palettes=['earth','neon','golden','mono','pastel'];
const cases=materials.flatMap((material,i)=>[0,1].map(j=>({
 material,mode:modes[i][j],
 orientation:(i+j)%2===0?'portrait':'landscape',
 seed:'V5Q-'+material.toUpperCase()+'-'+randomBytes(5).toString('hex').toUpperCase(),
 palette:palettes[(i*2+j)%palettes.length],
 density:56+((i*17+j*11)%23),
 elements:36+((i*19+j*9)%27),
 complexity:55+((i*23+j*7)%25),
 negativeSpace:43+((i*9+j*11)%22)
})));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1540,height:970}});
page.setDefaultTimeout(240000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const results=[];
try{
 await page.goto(process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/',
  {waitUntil:'domcontentloaded',timeout:60000});
 for(const file of [
   'oil-paint-v4e.js','composition-interpret-v5.js',
   'v5-material-adapters.js','composition-territories-v5c.js',
   'v5c-material-adapters.js','composition-guides-v5d.js',
   'v5d-material-adapters.js','composition-colour-fields-v5e.js',
   'v5e-material-adapters.js','composition-interlocking-v5f.js',
   'v5f-material-adapters.js','composition-connected-v5g.js',
   'v5g-material-adapters.js','composition-guide-fields-v5h.js',
   'composition-guide-fields-v5i.js','composition-material-v5j.js',
   'v5j-material-adapters.js','v5k-material-adapters.js',
   'v5l-material-adapters.js','v5m-material-adapters.js',
   'v5n-material-adapters.js','composition-broad-connections-v5o.js',
   'v5o-material-adapters.js','v5p-material-adapters.js',
   'v5q-four-material-interpretation.js'
 ]) await page.addScriptTag({url:'/js/'+file});
 for(const [i,item] of cases.entries()){
  const sample=await page.evaluate(input=>{
   const A=window.AlgoArt;
   A.rendererVersion=9;
   const settings={...A.readSettings(),...input,grain:13,
     paper:'#f5f0e6',colourCount:4,saturation:81,brightness:68,
     pen:'fine',thickness:13,wobble:40,overdraw:3,opacity:75,
     lines:true,circles:true,rectangles:true,polygons:true,arcs:true};
   const opts={phiFraming:true,interpretation:'areas',maxRegions:28,
     material:input.material};
   const full=document.createElement('canvas'),
     start=performance.now(),
     out=A.renderInterpretedV5Q(full,settings,1,opts);
   const pixels=full.getContext('2d').getImageData(
     0,0,full.width,full.height).data;
   let coloured=0,samples=0;
   for(let k=0;k<pixels.length;k+=4*37){
     const z=Math.abs(pixels[k]-245)+Math.abs(pixels[k+1]-240)+
       Math.abs(pixels[k+2]-230);
     if(z>32)coloured++;samples++;
   }
   const accepted=out.plan?.broadConnectionStats?.count||0;
   const work=out.work||out.source?.work||null;
   const data=full.toDataURL('image/png').split(',')[1];
   // Check actual faithful source rendering without asking generative AI.
   // All faithful files are stored only in pixel hash metadata, not output.
   return{
     png:data,width:full.width,height:full.height,
     plan:out.plan?{
       broadConnections:accepted,
       totalConnections:out.plan.connectedFields.length,
       linkedGuides:out.plan.connectedFields
         .filter(f=>f.kind==='guide-chain-colour-mass')
         .map(f=>f.guideIds),
       version:out.plan.version
     }:null,
     colouredFraction:coloured/Math.max(1,samples),
     work:work?{
       fields:work.broadFields||work.colourFields||0,
       contacts:work.materialContacts||work.guideDeposits||work.fieldStrokes||0,
       layers:work.laminations||0,
       pools:work.junctionPools||0
     }:null,
     elapsedMs:Math.round(performance.now()-start),
     material:input.material
   };
  },item);
  assert(sample.width>=750&&sample.height>=700,
   'Not full-size source render '+item.material+' '+item.seed+
    ' '+sample.width+'x'+sample.height);
  assert(sample.plan?.broadConnections>=1,
   'No V5o connection geometry used in '+item.material+' '+item.seed);
  assert(sample.work&&
    (sample.work.contacts>0||sample.work.layers>0),
   'No new source-connected material effect '+item.material);
  assert(sample.colouredFraction>.025,
   'Render unexpectedly empty '+item.material);
  const filename=(i+1).toString().padStart(2,'0')+'-'+
    item.material+'-'+item.mode+'-'+item.orientation+'-'+
    item.seed+'.png';
  const bytes=Buffer.from(sample.png,'base64');
  assert(bytes.length>50000,'Artwork output too small: '+filename);
  await writeFile(path.join(dir,filename),bytes);
  const{png,...meta}=sample;
  results.push({...item,file:filename,...meta,bytes:bytes.length});
  console.log('V5q REAL ARTWORK '+filename+' '+meta.width+'x'+meta.height+
   ' broad '+meta.plan.broadConnections+' '+meta.elapsedMs+'ms');
 }
 await writeFile(path.join(dir,'manifest.json'),JSON.stringify({
   experiment:'V5q actual ALGO/ART source-connected 4-material trials',
   origin:'ALGO/ART deterministic browser renderer; no ImageGen',
   versions:{
     geometry:'V5o source graph',
     tissue:'V5p torn edges + linked tissue layers + pooling',
     marker:'native A.render + guide-owned felt marker contact passes',
     watercolour:'released V2R + guide-owned translucent soft washes',
     oil:'Oil V4e/V5p + loaded V4e source-guide brush contacts'
   },
   images:results},null,2));
 assert.deepEqual(errors,[],'Browser errors');
 assert.equal(results.length,8);
 console.log('PASS V5q: eight full native-resolution engine artworks');
}finally{await browser.close()}
