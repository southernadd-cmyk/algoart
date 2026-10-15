// V5g actual ALGO/ART source renderer + geometry-first acceptance lab.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const dir='v5e-results/v5g';
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
const result=[];
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
  'v5g-material-adapters.js']){
  await page.addScriptTag({url:'/js/'+file});
 }
 for(const entry of cases){
  const out=await page.evaluate(entry=>{
   const A=window.AlgoArt;A.rendererVersion=9;
   const settings={...A.readSettings(),...entry,
    grain:13,paper:'#f5f0e6',colourCount:4,
    saturation:82,brightness:65,
    pen:'fine',thickness:13,wobble:38,overdraw:3,opacity:75,
    lines:true,circles:true,rectangles:true,polygons:true,arcs:true};
   const opts={phiFraming:true,interpretation:'areas',maxRegions:26};
   const before={recorder:A.svgRecorder,phi:A.phiFramingEnabled};
   const plan=A.planCompositionV5(settings,opts);
   const again=A.planCompositionV5(settings,opts);
   const deterministic=JSON.stringify(plan)===JSON.stringify(again);
   const flat=document.createElement('canvas');
   const flatStats=A.renderConnectedPlanV5G(flat,plan,.4);
   const imageData=flat.getContext('2d').getImageData(0,0,flat.width,flat.height).data;
   const filled=Array.from({length:imageData.length/4},(_,i)=>{
    const k=i*4;return Math.abs(imageData[k]-245)+
      Math.abs(imageData[k+1]-240)+Math.abs(imageData[k+2]-230)>32;
   }).filter(Boolean).length;
   const hasConnections=plan.connectedFields.every(area=>{
     if(area.components!==1||area.cells.length!==area.occupiedCells)return false;
     const points=new Set(area.cells);
     const reached=new Set(),q=[area.cells[0]];
     reached.add(q[0]);
     for(let j=0;j<q.length;j++){
      const n=q[j],x=n%area.gridWidth,w=area.gridWidth,
        candidates=[x>0?n-1:-1,x<w-1?n+1:-1,n-w,n+w];
      for(const a of candidates){
       if(points.has(a)&&!reached.has(a)){reached.add(a);q.push(a)}
      }
     }
     return reached.size===points.size;
   });
   const result={mode:entry.mode,orientation:entry.orientation,
     deterministic,hasConnections,flat:flat.toDataURL('image/png').split(',')[1],
     flatPixels:filled,stats:plan.connectedStats,areas:plan.connectedFields.map(f=>({
      area:f.area,box:f.box,fillFraction:f.fillFraction,
      sources:f.sources.length,occupiedCells:f.occupiedCells,
      connected:f.components===1})),renders:{}};
   for(const material of ['oil','tissue']){
     const ref=document.createElement('canvas');
     const v5f=document.createElement('canvas');
     const v5g=document.createElement('canvas');
     const repeat=document.createElement('canvas');
     A.renderInterpretedV5G(ref,settings,.4,{...opts,material,interpretation:'faithful'});
     const old=A.planCompositionV5;
     try{
       A.planCompositionV5=(s,o)=>A.compositionV5fFromSource(
         A.captureCompositionV5(s,o),s,o);
       A.renderInterpretedV5F(v5f,settings,.4,{...opts,material});
     }finally{A.planCompositionV5=old}
     A.renderInterpretedV5G(v5g,settings,.4,{...opts,material});
     A.renderInterpretedV5G(repeat,settings,.4,{...opts,material});
     const image=v5g.getContext('2d').getImageData(0,0,v5g.width,v5g.height).data,
        oldData=v5f.getContext('2d').getImageData(0,0,v5f.width,v5f.height).data,
        faith=ref.getContext('2d').getImageData(0,0,ref.width,ref.height).data;
     let againstV5f=0,againstFaithful=0,interior=0,interiorDiff=0;
     for(let k=0;k<image.length;k+=4){
       const d=(a,b)=>Math.abs(a[k]-b[k])+Math.abs(a[k+1]-b[k+1])+
         Math.abs(a[k+2]-b[k+2]);
       if(d(image,oldData)>18)againstV5f++;
       if(d(image,faith)>18)againstFaithful++;
     }
     // Sample filled INTERIOR cells, not strokes or bounding boxes.
     for(const area of plan.connectedFields){
       for(const cell of area.cells){
         const px=Math.floor(((cell%area.gridWidth)+.5)*area.gridCell*.4),
             py=Math.floor((Math.floor(cell/area.gridWidth)+.5)*area.gridCell*.4);
         const k=(py*v5g.width+px)*4;
         if(k+2>=image.length)continue;
         interior++;
         if(Math.abs(image[k]-faith[k])+Math.abs(image[k+1]-faith[k+1])+
            Math.abs(image[k+2]-faith[k+2])>18)interiorDiff++;
       }
     }
     result.renders[material]={
       faithful:ref.toDataURL('image/png').split(',')[1],
       v5f:v5f.toDataURL('image/png').split(',')[1],
       v5g:v5g.toDataURL('image/png').split(',')[1],
       deterministic:v5g.toDataURL()===repeat.toDataURL(),
       dimensions:{width:v5g.width,height:v5g.height},interiorSamples:interior,
       versusV5f:againstV5f,versusFaithful:againstFaithful,
       interiorCoverage:interior?interiorDiff/interior:0
     };
   }
   result.globalsSafe=A.svgRecorder===before.recorder&&
      A.phiFramingEnabled===before.phi;
   return result;
  },entry);
  assert(out.deterministic&&out.globalsSafe,'Plan is not deterministic/global-safe');
  assert(out.hasConnections,'One or more field masks are disconnected');
  if(entry.mode==='rects'){
    assert.equal(out.stats.count,0,'V5g must not alter V5c phi planes');
  }else{
    assert(out.stats.count>=1,'Source engine has no connected colour areas');
    assert(out.stats.totalArea>14000,'Only line-width area was generated');
    assert(out.areas.every(a=>a.sources>0&&a.connected&&
       a.box.w>=40&&a.box.h>=40&&a.fillFraction>.19),
      'Not large, filled and source-derived planar areas');
    assert(out.flatPixels>2500,'Flat geometric preview does not fill space');
  }
  for(const material of ['oil','tissue']){
   const q=out.renders[material];
   console.log('DEBUG V5g '+entry.mode+' '+material+
     ' '+JSON.stringify({dimensions:q.dimensions,interiorSamples:q.interiorSamples,
       delta:q.versusV5f,coverage:q.interiorCoverage}));
   assert(q.deterministic,material+' is not deterministic');
   if(entry.mode==='rects'){
    assert.equal(q.versusV5f,0,'Historical phi cells changed for '+material);
   }else{
    assert(q.versusV5f>(material==='oil'?2200:850),
      material+' did not materially change from V5f');
    assert(q.interiorCoverage>.32,
      material+' lacks actual occupied AREA; got '+q.interiorCoverage);
   }
   const prefix=entry.mode+'-'+entry.orientation+'-'+material;
   for(const version of ['faithful','v5f','v5g']){
    const bytes=Buffer.from(q[version],'base64');
    assert(bytes.length>14000,'Missing real source render: '+prefix+' '+version);
    await writeFile(path.join(dir,prefix+'-'+version+'.png'),bytes);
   }
   console.log('V5g '+entry.mode+' '+material+' areas '+out.stats.count+
     ' connected fill '+out.stats.totalArea+' vs V5f '+q.versusV5f+
     ' interior '+q.interiorCoverage.toFixed(3));
  }
  await writeFile(path.join(dir,entry.mode+'-flat-plan.png'),
    Buffer.from(out.flat,'base64'));
  result.push({mode:entry.mode,stats:out.stats,areas:out.areas,
    flatPixels:out.flatPixels,materials:Object.fromEntries(
      ['oil','tissue'].map(m=>[m,{versusV5f:out.renders[m].versusV5f,
        interiorCoverage:out.renders[m].interiorCoverage}]))});
 }
 const cards=[];
 for(const a of result){
  for(const m of ['oil','tissue'])for(const v of ['faithful','v5f','v5g'])
   cards.push({label:a.mode+' '+m+' '+v,
    file:a.mode+'-'+(a.mode==='organic'?'portrait':'landscape')+'-'+m+'-'+v+'.png'});
  cards.push({label:a.mode+' flat connected plan',file:a.mode+'-flat-plan.png'});
 }
 const sheet=await page.evaluate(async ({cards,dir})=>{
  const out=document.createElement('canvas');out.width=1680;out.height=1124;
  const ctx=out.getContext('2d');
  ctx.fillStyle='#ded8cf';ctx.fillRect(0,0,out.width,out.height);
  for(let i=0;i<cards.length;i++){
   const image=new Image();image.src='/'+dir+'/'+cards[i].file;
   await new Promise((yes,no)=>{image.onload=yes;image.onerror=no});
   const x=(i%7)*240,y=Math.floor(i/7)*281;
   ctx.fillStyle='#f5f0e6';ctx.fillRect(x+6,y+5,228,245);
   const s=Math.min(224/image.width,239/image.height);
   ctx.drawImage(image,x+120-image.width*s/2,y+126-image.height*s/2,
      image.width*s,image.height*s);
   ctx.fillStyle='#26231f';ctx.font='12px sans-serif';
   ctx.fillText(cards[i].label,x+7,y+264,228);
  }
  return out.toDataURL('image/jpeg',.92).split(',')[1];
 },{cards,dir});
 await writeFile(path.join(dir,'v5g-connected-flat-oil-tissue.jpg'),
  Buffer.from(sheet,'base64'));
 await writeFile(path.join(dir,'v5g-manifest.json'),
  JSON.stringify({version:'V5g filled connected areas',released:false,result},null,2));
 assert.deepEqual(errors,[],'Browser errors');
 console.log('PASS V5g: connected filled geometry across both physical materials; original Faithful/rectangles retained');
}finally{await browser.close()}
