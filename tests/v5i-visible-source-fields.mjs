// V5i: source-guide relationships BEFORE field geometry, 24 real image comparisons.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const dir='v5e-results/v5i';
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
const faults=[];page.on('pageerror',e=>faults.push(e.message));
const report=[];
try{
 await page.goto(process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/',
  {waitUntil:'domcontentloaded',timeout:60000});
 for(const name of [
  'oil-paint-v4e.js','composition-interpret-v5.js',
  'v5-material-adapters.js','composition-territories-v5c.js',
  'v5c-material-adapters.js','composition-guides-v5d.js',
  'v5d-material-adapters.js','composition-colour-fields-v5e.js',
  'v5e-material-adapters.js','composition-interlocking-v5f.js',
  'v5f-material-adapters.js','composition-connected-v5g.js',
  'v5g-material-adapters.js','composition-guide-fields-v5h.js','composition-guide-fields-v5i.js'])
   await page.addScriptTag({url:'/js/'+name});
 for(const entry of cases){
  const out=await page.evaluate(entry=>{
   const A=window.AlgoArt;A.rendererVersion=9;
   const settings={...A.readSettings(),...entry,
    grain:13,paper:'#f5f0e6',colourCount:4,
    saturation:82,brightness:65,pen:'fine',
    thickness:13,wobble:38,overdraw:3,opacity:75,
    lines:true,circles:true,rectangles:true,polygons:true,arcs:true};
   const opts={phiFraming:true,interpretation:'areas',maxRegions:26};
   const start=A.planCompositionV5(settings,opts),
         repeat=A.planCompositionV5(settings,opts);
   const flat=document.createElement('canvas');
   A.renderConnectedPlanV5H(flat,start,.4);
   const guideKinds=start.connectedFields.map(f=>f.relationKind);
   const distinctPairs=new Set(start.connectedFields.map(f=>
     f.guideIds.slice().sort().join('|'))).size===start.connectedFields.length;
   const linked=start.connectedFields.every(f=>
    f.guideIds.length===2&&f.sources.length>0&&
    f.members.length===2&&f.components===1&&
    f.cells.length===f.occupiedCells);
   const trueConnected=start.connectedFields.every(f=>{
     const mask=new Set(f.cells),seen=new Set([f.cells[0]]),
           q=[f.cells[0]],width=f.gridWidth;
     for(let k=0;k<q.length;k++){
       const i=q[k],x=i%width;
       const choices=[x?i-1:-1,x<width-1?i+1:-1,i-width,i+width];
       for(const v of choices)
         if(mask.has(v)&&!seen.has(v)){seen.add(v);q.push(v)}
     }
     return seen.size===mask.size;
   });
   const result={mode:entry.mode,plan:start,flat:flat.toDataURL('image/png').split(',')[1],
    linked,distinctPairs,trueConnected,guideKinds,deterministic:JSON.stringify(start)===JSON.stringify(repeat),
    material:{}};
   for(const material of ['oil','tissue']){
     const faithful=document.createElement('canvas'),
           old=document.createElement('canvas'),
           fresh=document.createElement('canvas'),
           again=document.createElement('canvas');
     A.renderInterpretedV5I(faithful,settings,.4,
       {...opts,material,interpretation:'faithful'});
     const planner=A.planCompositionV5;
     try{
       A.planCompositionV5=(s,o)=>A.compositionV5hFromSource(
         A.captureCompositionV5(s,o),s,o);
       A.renderInterpretedV5H(old,settings,.4,{...opts,material});
     }finally{A.planCompositionV5=planner}
     A.renderInterpretedV5I(fresh,settings,.4,{...opts,material});
     A.renderInterpretedV5I(again,settings,.4,{...opts,material});
     const a=fresh.getContext('2d').getImageData(0,0,fresh.width,fresh.height).data,
           b=old.getContext('2d').getImageData(0,0,old.width,old.height).data,
           f=faithful.getContext('2d').getImageData(0,0,faithful.width,faithful.height).data;
     let delta=0,insideCount=0,paintedCount=0;
     for(let i=0;i<a.length;i+=4){
       if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+
         Math.abs(a[i+2]-b[i+2])>18)delta++;
     }
     for(const field of start.connectedFields){
       for(const index of field.cells){
         const x=Math.floor(((index%field.gridWidth)+.5)*field.gridCell*.4),
            y=Math.floor((Math.floor(index/field.gridWidth)+.5)*field.gridCell*.4),
            p=(y*fresh.width+x)*4;
         if(p+2>=a.length)continue;
         insideCount++;
         if(Math.abs(a[p]-f[p])+Math.abs(a[p+1]-f[p+1])+
           Math.abs(a[p+2]-f[p+2])>18)paintedCount++;
       }
     }
     result.material[material]={
      delta:delta,
      occupiedCoverage:insideCount?paintedCount/insideCount:0,
      stable:fresh.toDataURL()===again.toDataURL(),
      faithful:faithful.toDataURL('image/png').split(',')[1],
      old:old.toDataURL('image/png').split(',')[1],
      fresh:fresh.toDataURL('image/png').split(',')[1]};
   }
   return result;
  },entry);
  assert(out.deterministic&&out.linked&&out.distinctPairs&&out.trueConnected,
    entry.mode+' guide ownership / connectivity failed');
  if(entry.mode==='rects'){
    assert.equal(out.plan.connectedFields.length,0,
      'V5c source φ cells must be retained unchanged');
  }else{
    assert(out.plan.connectedStats.visibleFields>=4,
      entry.mode+' must show FOUR DISTINCT source-linked regions; '+JSON.stringify(out.plan.connectedStats));
    assert(out.plan.connectedStats.minimumVisibleFraction>=.65,
      'A true source-linked area is hidden by later colour fields');
    assert(out.plan.connectedFields.length>=4,
      entry.mode+' must preserve four or more ACTUAL source-guide fields; got '+
         out.plan.connectedFields.length);
    assert(out.plan.connectedFields.every(f=>
       f.area>3000&&f.area<
       out.plan.width*out.plan.height*.225&&
       f.fillFraction>.14),
      'Guide-derived field fails actual occupied area or max size');
    assert(out.guideKinds.every(k=>k===
       (entry.mode==='organic'?'organic-branch':
        entry.mode==='spiral'?'trajectory-ribbon':'constructed-focal-form')),
      'Field materialized without source engine geometry');
  }
  const saved={mode:entry.mode,guideStats:out.plan.guideStats,
    connectedStats:out.plan.connectedStats,
    fields:out.plan.connectedFields.map(f=>({
      id:f.id,guideIds:f.guideIds,relationKind:f.relationKind,
      area:f.area,fillFraction:f.fillFraction,sources:f.sources,
      box:f.box
    })),material:{}};
  await writeFile(path.join(dir,entry.mode+'-flat-plan.png'),
    Buffer.from(out.flat,'base64'));
  for(const material of ['oil','tissue']){
    const m=out.material[material];
    assert(m.stable,entry.mode+' '+material+' render is not stable');
    if(entry.mode==='rects')assert.equal(m.delta,0,
       'V5c rectangles changed');
    else {
      assert(m.delta>850,'No visible new material interpretation');
      assert(m.occupiedCoverage>.38,'Source-connected INTERIOR not painted');
    }
    for(const [kind,base64] of Object.entries({
       faithful:m.faithful,v5h:m.old,v5i:m.fresh
    })){
      const file=entry.mode+'-'+entry.orientation+'-'+material+'-'+kind+'.png';
      await writeFile(path.join(dir,file),Buffer.from(base64,'base64'));
    }
    saved.material[material]={
      vsV5h:m.delta,occupiedCoverage:m.occupiedCoverage};
    console.log('V5i '+entry.mode+' '+material+
      ' visible source regions '+out.plan.connectedStats.visibleFields+
      ' compared '+m.delta+' connected interior '+m.occupiedCoverage.toFixed(3));
  }
  report.push(saved);
 }
 // 4 x [oil(3) + tissue(3) + flat(1)] = 28 genuine renders.
 const cards=[];
 for(const item of report){
  const orientation=item.mode==='organic'?'portrait':'landscape';
  for(const material of ['oil','tissue'])
   for(const kind of ['faithful','v5h','v5i'])
    cards.push({text:item.mode+' '+material+' '+kind,
      file:item.mode+'-'+orientation+'-'+material+'-'+kind+'.png'});
  cards.push({text:item.mode+' SOURCE GUIDE FLAT',
    file:item.mode+'-flat-plan.png'});
 }
 const sheet=await page.evaluate(async({cards,dir})=>{
  const canvas=document.createElement('canvas');canvas.width=1680;canvas.height=1124;
  const g=canvas.getContext('2d');g.fillStyle='#ded8cf';g.fillRect(0,0,1680,1124);
  for(let i=0;i<cards.length;i++){
   const img=new Image();img.src='/'+dir+'/'+cards[i].file;
   await new Promise((yes,no)=>{img.onload=yes;img.onerror=no});
   const x=(i%7)*240,y=Math.floor(i/7)*281,s=Math.min(222/img.width,238/img.height);
   g.fillStyle='#f5f0e6';g.fillRect(x+6,y+5,228,245);
   g.drawImage(img,x+120-img.width*s/2,y+126-img.height*s/2,img.width*s,img.height*s);
   g.fillStyle='#26231f';g.font='12px sans-serif';
   g.fillText(cards[i].text,x+7,y+263,226);
  }
  return canvas.toDataURL('image/jpeg',.91).split(',')[1];
 },{cards,dir});
 await writeFile(path.join(dir,'v5i-guide-fields-comparison.jpg'),Buffer.from(sheet,'base64'));
 await writeFile(path.join(dir,'v5i-manifest.json'),
   JSON.stringify({version:'V5i V5d source-guide related fields',released:false,report},null,2));
 assert.deepEqual(faults,[]);
 console.log('PASS V5i: distinct connected colour fields derive from the actual source-guide relationships');
}finally{await browser.close()}
