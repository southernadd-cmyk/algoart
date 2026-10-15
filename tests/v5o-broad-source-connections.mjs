// V5o: audit selected and unpaired painted guide coverage; immutable V5i source geometry.
// 4 original engine fixtures x 2 physical materials x 3 representations,
// plus source and material-colour flat previews. No live posts / API writes.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const dir='v5e-results/v5o';
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
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
const report=[];
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
   'v5j-material-adapters.js','v5k-material-adapters.js','v5l-material-adapters.js','v5m-material-adapters.js','v5n-material-adapters.js','composition-broad-connections-v5o.js','v5o-material-adapters.js'])
   await page.addScriptTag({url:'/js/'+file});
 for(const entry of cases){
  const sample=await page.evaluate(entry=>{
   const A=window.AlgoArt;A.rendererVersion=9;
   const settings={...A.readSettings(),...entry,
    grain:13,paper:'#f5f0e6',colourCount:4,
    saturation:82,brightness:65,pen:'fine',
    thickness:13,wobble:38,overdraw:3,opacity:75,
    lines:true,circles:true,rectangles:true,polygons:true,arcs:true};
   const opts={phiFraming:true,interpretation:'areas',maxRegions:26};
   const source=A.captureCompositionV5(settings,opts);
   const oldPlan=A.compositionV5jFromSource(source,settings,opts);
   const plan=A.planCompositionV5FromSource(source,settings,opts);
   const repeated=A.planCompositionV5FromSource(source,settings,opts);
   const stable=JSON.stringify(plan)===JSON.stringify(repeated);
   // Deliberately ignore V5o paint metadata for the geometry identity test.
   const geometry=f=>({
     contour:f.contour,cells:f.cells,area:f.area,guideIds:f.guideIds,
     sources:f.sources,rgb:f.rgb,box:f.box,seed:f.seed
   });
   const sameSource=JSON.stringify(oldPlan.connectedFields.map(geometry))===
     JSON.stringify(plan.connectedFields.slice(-oldPlan.connectedFields.length).map(geometry));
   const assignments=plan.connectedFields.map(f=>({
      sourceRgb:f.rgb,paintRgb:f.paintRgb,
      deltaFromSource:f.paintTone.deltaFromSource,
      originalSources:f.sources,
      guideIds:f.guideIds,
      paintPalette:f.paintPalette}));
   const sourceFlat=document.createElement('canvas'),
     materialFlat=document.createElement('canvas');
   A.renderConnectedPlanV5I(sourceFlat,oldPlan,.4);
   A.renderConnectedPlanV5O(materialFlat,plan,.4);
   const out={mode:entry.mode,orientation:entry.orientation,
     stable,sameSource,assignments,stats:plan.connectedStats,
     broad:plan.broadConnectionStats,originalFields:oldPlan.connectedFields.length,
     materialStats:plan.materialStats,
     flatSource:sourceFlat.toDataURL('image/png').split(',')[1],
     flatPaint:materialFlat.toDataURL('image/png').split(',')[1],
     materials:{}};
   for(const material of ['oil','tissue']){
     const faithful=document.createElement('canvas'),
       old=document.createElement('canvas'),
       fresh=document.createElement('canvas'),
       again=document.createElement('canvas');
     const faith=A.renderInterpretedV5O(faithful,settings,.4,
       {...opts,material,interpretation:'faithful'});
     const currentPlanner=A.planCompositionV5;
     A.planCompositionV5=(s,o)=>A.compositionV5jFromSource(A.captureCompositionV5(s,o),s,o);
     const oldResult=A.renderInterpretedV5N(old,settings,.4,{...opts,material});
     A.planCompositionV5=currentPlanner;
     const oldFaithful=document.createElement('canvas');
     A.renderInterpretedV5N(oldFaithful,settings,.4,{...opts,material,interpretation:'faithful'});
     const faithfulSame=faithful.toDataURL()===oldFaithful.toDataURL();
     const freshResult=A.renderInterpretedV5O(fresh,settings,.4,{...opts,material});
     A.renderInterpretedV5O(again,settings,.4,{...opts,material});
     const a=fresh.getContext('2d').getImageData(0,0,fresh.width,fresh.height).data,
       b=old.getContext('2d').getImageData(0,0,old.width,old.height).data,
       f=faithful.getContext('2d').getImageData(0,0,faithful.width,faithful.height).data;
     let changed=0,observations=0,sumOld=0,sumFresh=0,coloured=0;
     for(let i=0;i<a.length;i+=4){
      if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+
         Math.abs(a[i+2]-b[i+2])>18)changed++;
     }
     for(const field of plan.connectedFields){
      for(const cell of field.cells){
       const x=Math.floor(((cell%field.gridWidth)+.5)*field.gridCell*.4),
         y=Math.floor((Math.floor(cell/field.gridWidth)+.5)*field.gridCell*.4),
         i=(y*fresh.width+x)*4;
       if(i+2>=a.length)continue;
       observations++;
       const before=Math.abs(b[i]-f[i])+Math.abs(b[i+1]-f[i+1])+
         Math.abs(b[i+2]-f[i+2]);
       const after=Math.abs(a[i]-f[i])+Math.abs(a[i+1]-f[i+1])+
         Math.abs(a[i+2]-f[i+2]);
       sumOld+=before;sumFresh+=after;if(after>18)coloured++;
      }
     }
     // Compare atmospheric pigment OUTSIDE legitimate geometry against the
     // untouched cream paper. Comparing to Faithful would perversely treat
     // removal of V7's broad washed-out bloom as a regression.
     const masks=plan.connectedFields.map(field=>({
       cells:new Set(field.cells),width:field.gridWidth,cell:field.gridCell}));
     let outsideOld=0,outsideNew=0,outsideCount=0;
     for(let y=4;y<fresh.height-4;y+=4)for(let x=4;x<fresh.width-4;x+=4){
       const gx=x/.4,gy=y/.4;
       if(masks.some(m=>m.cells.has(Math.floor(gy/m.cell)*m.width+
         Math.floor(gx/m.cell))))continue;
       const i=(y*fresh.width+x)*4;
       const deviation=img=>Math.abs(img[i]-245)+Math.abs(img[i+1]-240)+
         Math.abs(img[i+2]-230);
       outsideOld+=deviation(b);
       outsideNew+=deviation(a);
       outsideCount++;
     }
     const painted=plan.territories.filter(g=>g.role==='painted'&&
     g.kind!=='rect-cell'&&g.sources?.length);
   const coveredGuideIds=new Set(plan.connectedFields.flatMap(f=>f.guideIds));
   const unpaired=painted.filter(g=>!coveredGuideIds.has(g.guideId));
   out.paintedGuideCount=painted.length;
   out.unpairedGuideCount=unpaired.length;
   out.unpairedGuideIds=unpaired.map(g=>g.guideId);
   out.materials[material]={
      stable:fresh.toDataURL()===again.toDataURL(),changed,faithfulSame,
      outsideOld:outsideCount?outsideOld/outsideCount:0,
       outsideNew:outsideCount?outsideNew/outsideCount:0,
       meanOld:observations?sumOld/observations:0,
      meanNew:observations?sumFresh/observations:0,
      interiorCoverage:observations?coloured/observations:0,
      fieldStrokes:freshResult.work?.fieldStrokes||0,
      fieldPieces:freshResult.work?.fieldPieces||0,
      guideDeposits:freshResult.work?.guideDeposits||0,
      edgeTouches:freshResult.work?.edgeTouches||0,
      sourceFolds:freshResult.work?.sourceFolds||0,
      unpairedGuides:freshResult.work?.unpairedGuides||0,
      unpairedDeposits:freshResult.work?.unpairedDeposits||0,
      paintedGuides:freshResult.work?.paintedGuides||0,
      faithful:faithful.toDataURL('image/png').split(',')[1],
      v5n:old.toDataURL('image/png').split(',')[1],
      v5o:fresh.toDataURL('image/png').split(',')[1]
     };
   }
   return out;
  },entry);
  assert(sample.stable&&sample.sameSource,'V5o mutated source geometry or seed');
  assert(sample.assignments.every(f=>f.originalSources.length&&
    f.guideIds.length>=2&&f.guideIds.length<=4&&f.paintPalette.length&&
    f.deltaFromSource<=78),
    'Changed painted pigment not anchored to source colours');
  if(entry.mode==='rects'){
    assert.equal(sample.assignments.length,0,
      'Recursive Divisions original φ cells should not be retouched');
  }else{
    console.log('V5o DIAGNOSTIC '+entry.mode+' '+JSON.stringify(sample.broad));
     assert(sample.stats.visibleFields>=4&&
       sample.stats.minimumVisibleFraction>=.65,
       'V5o has lost four visibly source-linked fields');
  }
  for(const material of ['oil','tissue']){
   const q=sample.materials[material];
   assert(q.stable,material+' material output is not deterministic');
   assert(q.faithfulSame,material+' Faithful output changed');
   if(entry.mode==='rects')assert.equal(q.changed,0,
     'Original Recursive Divisions material pixels changed');
   else{
     assert(q.changed>1000,'V5o must visibly change this material');
      assert(q.interiorCoverage>.28,material+' lacks real 2D pigment interiors');
     if(material==='tissue')console.log('DIAG V5o '+entry.mode+' exterior pigment: '+q.outsideOld.toFixed(3)+' → '+q.outsideNew.toFixed(3));
     if(material==='tissue'){
       // V7 atmosphere is left fully intact. New source-owned Tissue
       // is a materially visible overlay rather than bloom suppression.
       assert(q.meanNew>=45,
         'V5o Tissue is too faint relative to faithful V7');
       assert(q.fieldPieces>=4,
         'Tissue must have separately laminated source sheets');
     }
     if(material==='tissue'){
       assert.equal(q.paintedGuides,sample.paintedGuideCount,
         'V5o lost source-guide coverage accounting');
       assert.equal(q.unpairedGuides,sample.unpairedGuideCount,
         'One or more unpaired source shapes got ignored');
       assert.equal(q.unpairedDeposits,q.unpairedGuides*19,
         'Every unpaired source guide must receive physical pigment');
     }
     if(material==='tissue')assert(q.guideDeposits>=80,
       'Physical tissue deposits must follow real source guide axes');
     if(material==='tissue')assert(q.edgeTouches>=20,
       'Torn fibre edge sampling missing');
     if(material==='tissue')assert(q.sourceFolds>=18,
       'Guide-owned tissue creases missing for this engine');
     if(material==='oil')assert(q.fieldStrokes>=8,
       'Oil no longer has real loaded contact brush marks');
     if(material==='tissue')assert(q.fieldPieces>=4,
       'Tissue sheets have not been rendered as multiple separate pieces');
   }
   for(const kind of ['faithful','v5n','v5o']){
    const file=entry.mode+'-'+entry.orientation+'-'+material+'-'+kind+'.png';
    const bytes=Buffer.from(q[kind],'base64');
    assert(bytes.length>12000,'Empty source output '+file);
    await writeFile(path.join(dir,file),bytes);
   }
   console.log('V5o '+entry.mode+' '+material+
     ' visible '+sample.stats.visibleFields+' changed '+q.changed+
     ' old pigment '+q.meanOld.toFixed(2)+' new pigment '+q.meanNew.toFixed(2)+
     ' interior '+q.interiorCoverage.toFixed(3)+
     ' outside pigment '+q.outsideOld.toFixed(2)+'→'+q.outsideNew.toFixed(2)+
      ' strokes '+q.fieldStrokes+' sheets '+q.fieldPieces);
  }
  await writeFile(path.join(dir,entry.mode+'-source-flat.png'),
    Buffer.from(sample.flatSource,'base64'));
  await writeFile(path.join(dir,entry.mode+'-material-flat.png'),
    Buffer.from(sample.flatPaint,'base64'));
  report.push({
   mode:entry.mode,orientation:entry.orientation,
   originalGeometryPreserved:sample.sameSource,stats:sample.stats,
    broadConnections:sample.broad,originalFields:sample.originalFields,
   paintedGuideCount:sample.paintedGuideCount,
   unpairedGuideCount:sample.unpairedGuideCount,
   unpairedGuideIds:sample.unpairedGuideIds,
   pigment:sample.materialStats,assignments:sample.assignments,
   materials:Object.fromEntries(Object.entries(sample.materials).map(
    ([material,q])=>[material,{changed:q.changed,
      meanOld:q.meanOld,meanNew:q.meanNew,
      interiorCoverage:q.interiorCoverage,
      fieldStrokes:q.fieldStrokes,fieldPieces:q.fieldPieces,
      guideDeposits:q.guideDeposits,edgeTouches:q.edgeTouches,
      sourceFolds:q.sourceFolds,unpairedGuides:q.unpairedGuides,
      unpairedDeposits:q.unpairedDeposits,paintedGuides:q.paintedGuides}]))
  });
 }
 const cards=[];
 for(const e of cases){
   for(const material of ['oil','tissue'])
    for(const kind of ['faithful','v5n','v5o'])
     cards.push({label:e.mode+' '+material+' '+kind,
       file:e.mode+'-'+e.orientation+'-'+material+'-'+kind+'.png'});
   cards.push({label:e.mode+' source plan',file:e.mode+'-source-flat.png'});
   cards.push({label:e.mode+' colour plan',file:e.mode+'-material-flat.png'});
 }
 const contact=await page.evaluate(async({cards,dir})=>{
  const c=document.createElement('canvas');c.width=1920;c.height=1124;
  const g=c.getContext('2d');g.fillStyle='#d9d4cb';g.fillRect(0,0,1920,1124);
  for(let i=0;i<cards.length;i++){
    const item=cards[i],image=new Image();image.src='/'+dir+'/'+item.file;
    await new Promise((resolve,reject)=>{
      image.onload=resolve;image.onerror=()=>reject(Error('Missing '+item.file));
    });
    const x=(i%8)*240,y=Math.floor(i/8)*281,
      s=Math.min(224/image.width,235/image.height);
    g.fillStyle='#f5f0e6';g.fillRect(x+5,y+4,230,247);
    g.drawImage(image,x+120-image.width*s/2,y+124-image.height*s/2,
      image.width*s,image.height*s);
    g.fillStyle='#25221f';g.font='12px sans-serif';
    g.fillText(item.label,x+6,y+263,228);
  }
  return c.toDataURL('image/jpeg',.92).split(',')[1];
 },{cards,dir});
 await writeFile(path.join(dir,'v5o-material-comparison.jpg'),Buffer.from(contact,'base64'));
 await writeFile(path.join(dir,'v5o-evidence.json'),JSON.stringify({
   version:'V5o source-pigment/material experiment',deployed:false,report},null,2));
 assert.deepEqual(pageErrors,[],'Browser page errors');
 console.log('PASS V5o: actual source geometry preserved, real material texture and bounded local pigment contrast');
}finally{await browser.close()}
