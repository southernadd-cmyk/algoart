// V5p evidence: real ALGO/ART material/browser renders. No AI images.
// Original V7 / V5o / V5p edge-only / layers / joined pigment pooling.
// Production gallery, oil material and V5o composition geometry are frozen.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const dir='v5e-results/v5p';
await mkdir(dir,{recursive:true});
const cases=[
 {seed:'V5-MASS-ORGANIC-20261015',mode:'organic',orientation:'portrait',
  density:76,elements:57,complexity:75,negativeSpace:53,palette:'earth'},
 {seed:'V5-MASS-RECTS-20261015',mode:'rects',orientation:'landscape',
  density:63,elements:42,complexity:67,negativeSpace:56,palette:'golden'},
 {seed:'V5-MASS-SPIRAL-20261015',mode:'spiral',orientation:'landscape',
  density:62,elements:36,complexity:60,negativeSpace:58,palette:'neon'},
 {seed:'V5D-CONSTRUCTED-20261015',mode:'geometric',orientation:'landscape',
  density:63,elements:42,complexity:63,negativeSpace:53,palette:'earth'}
];
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:970}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const report=[];
const cards=[];
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
   'v5o-material-adapters.js','v5p-material-adapters.js'
 ]) await page.addScriptTag({url:'/js/'+file});
 for(const entry of cases){
  const sample=await page.evaluate(entry=>{
   const A=window.AlgoArt;A.rendererVersion=9;
   const settings={...A.readSettings(),...entry,grain:13,paper:'#f5f0e6',
     colourCount:4,saturation:82,brightness:65,pen:'fine',thickness:13,
     wobble:38,overdraw:3,opacity:75,lines:true,circles:true,
     rectangles:true,polygons:true,arcs:true};
   const opts={phiFraming:true,interpretation:'areas',maxRegions:26};
   const plan=A.planCompositionV5(settings,opts);
   const next=A.planCompositionV5(settings,opts);
   const prior=A.compositionV5jFromSource(A.captureCompositionV5(settings,opts),settings,opts);
   const geometry=f=>({contour:f.contour,cells:f.cells,
      sources:f.sources,guideIds:f.guideIds,seed:f.seed});
   const sameOld=JSON.stringify(prior.connectedFields.map(geometry))===
      JSON.stringify(plan.connectedFields.slice(-prior.connectedFields.length).map(geometry));
   const flat=document.createElement('canvas');
   A.renderConnectedPlanV5O(flat,plan,.4);
   const make=(fn,material,extras={})=>{
     const canvas=document.createElement('canvas');
     const stats=fn(canvas,settings,.4,{...opts,material,...extras});
     return{canvas,stats,png:canvas.toDataURL('image/png').split(',')[1]};
   };
   const versions={
     faithful:make(A.renderInterpretedV5P,'tissue',{interpretation:'faithful'}),
     v5o:make(A.renderInterpretedV5O,'tissue'),
     edge:make(A.renderInterpretedV5P,'tissue',{stage:'edge'}),
     layers:make(A.renderInterpretedV5P,'tissue',{stage:'layers'}),
     v5p:make(A.renderInterpretedV5P,'tissue',{stage:'pooled'}),
     oilV5o:make(A.renderInterpretedV5O,'oil'),
     oilV5p:make(A.renderInterpretedV5P,'oil')
   };
   const oldFaithful=make(A.renderInterpretedV5O,'tissue',{interpretation:'faithful'});
   const sameFaithful=oldFaithful.canvas.toDataURL()===
      versions.faithful.canvas.toDataURL();
   const repeat=make(A.renderInterpretedV5P,'tissue',{stage:'pooled'});
   const stable=repeat.canvas.toDataURL()===versions.v5p.canvas.toDataURL();
   const sameOil=versions.oilV5o.canvas.toDataURL()===
     versions.oilV5p.canvas.toDataURL();
   const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   const delta=(ca,cb)=>{
      const a=pixels(ca),b=pixels(cb);let changed=0;
      for(let i=0;i<a.length;i+=4)if(
       Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+
       Math.abs(a[i+2]-b[i+2])>18)changed++;
      return changed;
   };
   const broad=plan.connectedFields.filter(x=>x.kind==='guide-chain-colour-mass');
   const voids=plan.protectedVoids||[],a=pixels(versions.v5p.canvas),
      b=pixels(versions.v5o.canvas);
   let escaped=0,voidChanged=0;
   for(let y=0;y<versions.v5p.canvas.height;y+=3)
   for(let x=0;x<versions.v5p.canvas.width;x+=3){
      const index=(y*versions.v5p.canvas.width+x)*4;
      const diff=Math.abs(a[index]-b[index])+
        Math.abs(a[index+1]-b[index+1])+
        Math.abs(a[index+2]-b[index+2]);
      if(diff<=18)continue;
      const xx=x/.4,yy=y/.4;
      if(!broad.some(f=>xx>=f.box.x-4&&xx<=f.box.x+f.box.w+4&&
         yy>=f.box.y-4&&yy<=f.box.y+f.box.h+4))escaped++;
      if(voids.some(v=>xx>=v.x&&xx<v.x+v.w&&yy>=v.y&&yy<v.y+v.h))
         voidChanged++;
   }
   return{
     mode:entry.mode,orientation:entry.orientation,
     stable,sameOld,sameFaithful,sameOil,escaped,voidChanged,
     broad:plan.broadConnectionStats,fields:plan.connectedFields.length,
     sourceIntegrity:plan.connectedFields.every(f=>f.guideIds.length>=2&&
       f.sources.length>0),
     change:{
       originalToEdge:delta(versions.v5o.canvas,versions.edge.canvas),
       edgeToLayers:delta(versions.edge.canvas,versions.layers.canvas),
       layersToPool:delta(versions.layers.canvas,versions.v5p.canvas),
       originalToFinal:delta(versions.v5o.canvas,versions.v5p.canvas)
     },
     stages:{
       edge:versions.edge.stats.work,
       layers:versions.layers.stats.work,
       pooled:versions.v5p.stats.work
     },
     files:{
       faithful:versions.faithful.png,v5o:versions.v5o.png,
       edge:versions.edge.png,layers:versions.layers.png,
       v5p:versions.v5p.png,oilV5o:versions.oilV5o.png,
       oilV5p:versions.oilV5p.png,
       geometry:flat.toDataURL('image/png').split(',')[1]
     }
   };
  },entry);
  assert(sample.stable,'V5p seed fails deterministic rendering');
  assert(sample.sameOld,'V5p changed existing guide fields');
  assert(sample.sameFaithful,'V5p changed original faithful Tissue V7');
  assert(sample.sameOil,'V5p changed Oil output despite material-only scope');
  assert(sample.sourceIntegrity,'Source guide provenance lost');
  assert.equal(sample.escaped,0,'Changed pixels escaped original broad field bounding envelopes');
  assert.equal(sample.voidChanged,0,'Protected void was painted');
  if(entry.mode==='rects'){
    assert.equal(sample.broad.count,0,'Recursive Divisions obtained invented broad shapes');
    assert.equal(sample.change.originalToFinal,0,'Recursive Divisions was changed');
  }else{
    assert(sample.broad.count>=2,'Missing previously approved broad V5o fields');
    assert(sample.change.originalToEdge>100,
       'Physical edge breakup did not visibly change the broad fields');
    assert(sample.change.edgeToLayers>300,
       'Physical source-guide sheets did not visibly accumulate');
    assert(sample.change.layersToPool>25,
       'Subtractive joint pigment pooling had no visible effect');
    assert(sample.stages.edge.edgeTouches>0,'Torn edge fibre detail absent');
    assert(sample.stages.layers.laminations>=sample.broad.count*2,
       'Insufficient independently torn tissue pieces on real source links');
    assert(sample.stages.pooled.junctionPools>=1,
       'No pigment pooling at source guide junctions');
  }
  const base=entry.mode+'-'+entry.orientation+'-';
  for(const [k,png] of Object.entries(sample.files)){
    const name=base+(k==='geometry'?'geometry':k.startsWith('oil')?
      'oil-'+k.slice(3).toLowerCase():'tissue-'+k)+'.png';
    const buffer=Buffer.from(png,'base64');
    assert(buffer.length>(k==='geometry'?500:10000),'Empty image '+name);
    await writeFile(path.join(dir,name),buffer);
    if(k!=='geometry')cards.push({label:entry.mode+' '+k,file:name});
  }
  cards.push({label:entry.mode+' source fields',file:base+'geometry.png'});
  const {files,...entryEvidence}=sample;
  report.push(entryEvidence);
  console.log('V5p '+entry.mode+': broad '+sample.broad.count+
    ' changed '+JSON.stringify(sample.change)+
    ' sheets '+sample.stages.pooled.laminations+
    ' fibre edges '+sample.stages.pooled.edgeTouches+
    ' pools '+sample.stages.pooled.junctionPools+
    ' faithful='+sample.sameFaithful+' oil='+sample.sameOil);
 }
 const contact=await page.evaluate(async({cards,dir})=>{
   const cols=8,w=1920,h=1124,c=document.createElement('canvas');
   c.width=w;c.height=h;
   const g=c.getContext('2d');g.fillStyle='#dad5ce';g.fillRect(0,0,w,h);
   for(let i=0;i<cards.length;i++){
     const item=cards[i],im=new Image();im.src='/'+dir+'/'+item.file;
     await new Promise((ok,bad)=>{im.onload=ok;im.onerror=()=>bad(Error(item.file))});
     const x=(i%cols)*240,y=Math.floor(i/cols)*281,
       scale=Math.min(220/im.width,225/im.height);
     g.fillStyle='#f5f0e6';g.fillRect(x+6,y+6,226,239);
     g.drawImage(im,x+120-im.width*scale/2,y+123-im.height*scale/2,
       im.width*scale,im.height*scale);
     g.fillStyle='#282520';g.font='12px sans-serif';
     g.fillText(item.label,x+8,y+263,225);
   }
   return c.toDataURL('image/jpeg',.9).split(',')[1];
 },{cards,dir});
 await writeFile(path.join(dir,'v5p-contact-sheet.jpg'),Buffer.from(contact,'base64'));
 await writeFile(path.join(dir,'v5p-evidence.json'),JSON.stringify({
   version:'V5p1 edges → V5p2 source-link layers → V5p3 pigment pooling',
   productionChanged:false,report},null,2));
 assert.deepEqual(errors,[],'Browser script errors');
 console.log('PASS V5p: source-owned torn edges/layers/junction pooling, frozen V5o geometry, untouched faithful V7 and Oil');
}finally{await browser.close()}
