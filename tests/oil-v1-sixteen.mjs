// Generates the *real procedural Oil V1* images; no model image generation.
// Eight fixed studies: exact, frozen settings. Eight additional deterministic
// random studies: four portrait/four landscape, sparse through dense.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const host=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const root='oil-v1-results';
await mkdir(path.join(root,'fixed'),{recursive:true});
await mkdir(path.join(root,'random'),{recursive:true});
const modes=[
  ['field','Orbital Studies'],['spiral','Golden Trajectories'],
  ['rects','Recursive Divisions'],['burst','Radiant Systems'],
  ['network','Connected Fields'],['organic','Growth Systems'],
  ['geometric','Constructed Forms'],['scribble','Automatic Marks']
];
const orientation=['portrait','landscape','landscape','portrait',
  'landscape','portrait','landscape','portrait'];
const fixed=modes.map(([mode,label],i)=>({
  group:'fixed',number:i+1,mode,label,orientation:orientation[i],
  seed:'OILV1-FIX-'+String(i+1).padStart(2,'0')+'-'+mode.toUpperCase()+'-20261014',
  elements:24+i*3,density:50+(i%3)*8,complexity:53+(i%4)*10,
  negativeSpace:51+(i%3)*8,phiStrength:92,recursion:4,spiralInfluence:63,
  goldenAngle:93,nesting:48,curveBias:55+(i%3)*12,
  shapeAmount:67,overlap:52,rotation:60,
  palette:['golden','earth','mono','neon','golden','earth','mono','neon'][i]
}));
function rng(seed){let state=seed>>>0;return()=>{state+=0x6D2B79F5;
  let a=state;a=Math.imul(a^(a>>>15),a|1);a^=a+Math.imul(a^(a>>>7),a|61);
  return ((a^(a>>>14))>>>0)/4294967296}};
const rand=rng(0x0a17beef);
// Shuffle the complete eight-engine set using a seeded permutation.
// Random settings/seeds are independent of the frozen fixed studies.
const shuffled=[0,1,2,3,4,5,6,7];
for(let i=shuffled.length-1;i>0;i--){
  const j=Math.floor(rand()*(i+1));
  const swap=shuffled[i];shuffled[i]=shuffled[j];shuffled[j]=swap;
}
const random=Array.from({length:8},(_,i)=>{
  const index=shuffled[i],[mode,label]=modes[index];
  const density=['sparse','sparse','medium','medium','dense','dense','layered','layered'][i];
  const amount=density==='sparse'?[16,30]:density==='medium'?[31,49]:
    density==='dense'?[50,69]:[65,78];
  return {group:'random',number:i+1,mode,label,
    orientation:i%2?'portrait':'landscape',densityClass:density,
    seed:'OILV1-RND-'+String(i+1).padStart(2,'0')+'-'+Math.floor(rand()*100000000).toString(36).toUpperCase(),
    elements:Math.round(amount[0]+rand()*(amount[1]-amount[0])),
    density:Math.round(32+rand()*53),complexity:Math.round(38+rand()*58),
    negativeSpace:Math.round(28+rand()*55),phiStrength:Math.round(74+rand()*26),
    recursion:Math.round(2+rand()*5),spiralInfluence:Math.round(28+rand()*69),
    goldenAngle:Math.round(72+rand()*28),nesting:Math.round(35+rand()*60),
    curveBias:Math.round(15+rand()*83),shapeAmount:Math.round(35+rand()*64),
    overlap:Math.round(20+rand()*76),rotation:Math.round(rand()*100),
    palette:['golden','earth','neon','mono'][Math.floor(rand()*4)]};
});
const all=fixed.concat(random),browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1550,height:1150},deviceScaleFactor:1});
const faults=[];page.on('pageerror',e=>faults.push(e.message));
const result=[];
try{
  await page.goto(host,{waitUntil:'domcontentloaded',timeout:60000});
  await page.addScriptTag({url:'/js/oil-paint-v1.js'});
  for(const item of all){
    const filename='oil-v1-'+item.group+'-'+String(item.number).padStart(2,'0')+'-'+item.mode+'-'+item.orientation+'.png';
    const stats=await page.evaluate(entry=>{
      const A=window.AlgoArt;
      A.rendererVersion=9;
      const config={...A.readSettings(),...entry,
        paper:'#f5f0e6',grain:13,colourCount:4,saturation:89,brightness:62,
        pen:'fine',thickness:13,wobble:38,overdraw:3,opacity:75,
        lines:true,circles:true,rectangles:true,polygons:true,arcs:true};
      const canvas=document.getElementById('oil-v1-stage')||document.createElement('canvas');
      canvas.id='oil-v1-stage';if(!canvas.isConnected)document.body.append(canvas);
      const original=A.phiFramingEnabled,started=performance.now();
      try{
        const stats=A.renderOilPaintV1(canvas,config,.7,
          {phiFraming:true,thickness:.8,drag:.54,bristles:.88});
        if(A.phiFramingEnabled!==original)throw Error('φ framing global state was not restored');
        return {...stats,ms:Math.round(performance.now()-started)};
      }catch(e){throw Error(entry.mode+' '+entry.seed+': '+e.message)}
    },item);
    assert.equal(stats.material,'oil-paint-v1');
    assert(stats.paths>0&&stats.paintedPaths>0,'Empty Oil V1: '+filename);
    assert.equal(stats.seed,item.seed);
    assert.equal(stats.phiFraming,true);
    assert(stats.sourceColours.length>0);
    const image=page.locator('#oil-v1-stage');
    const size=await image.evaluate(c=>[c.width,c.height]);
    assert.deepEqual(size,item.orientation==='portrait'?[700,980]:[980,700]);
    await image.screenshot({path:path.join(root,item.group,filename),timeout:45000});
    console.log('OIL V1 '+item.group+' '+item.number+'/8 '+item.mode+' '+item.orientation+
      ' paths '+stats.paintedPaths+' '+stats.ms+'ms');
    result.push({...item,file:item.group+'/'+filename,stats:stats});
  }
  // Strict seed/geometry/material determinism regression (the same browser).
  const repeat=await page.evaluate(entry=>{
    const A=window.AlgoArt,settings={...A.readSettings(),...entry,paper:'#f5f0e6',
      grain:13,colourCount:4,saturation:89,brightness:62,pen:'fine',
      thickness:13,wobble:38,overdraw:3,opacity:75,
      lines:true,circles:true,rectangles:true,polygons:true,arcs:true};
    let a=document.createElement('canvas'),b=document.createElement('canvas');
    const options={phiFraming:true,thickness:.8,drag:.54,bristles:.88};
    A.renderOilPaintV1(a,settings,.52,options);
    A.renderOilPaintV1(b,settings,.52,options);
    return a.toDataURL('image/png')===b.toDataURL('image/png');
  },fixed[0]);
  assert.equal(repeat,true,'Oil V1 did not render deterministically');
  assert.deepEqual(faults,[],'Browser runtime errors');

  // Build contact sheets using local browser screenshot + loaded images.
  // The static server serves oil-v1-results/ after PNGs have been written.
  for(const group of ['fixed','random']){
    const items=result.filter(e=>e.group===group).map(e=>({
      text:String(e.number).padStart(2,'0')+' · '+e.mode+' · '+e.orientation,
      file:'/'+root+'/'+e.file
    }));
    const image=await page.evaluate(async values=>{
      const cols=4,cw=300,ch=250;
      const sheet=document.createElement('canvas');sheet.width=cols*cw;sheet.height=2*ch;
      const ctx=sheet.getContext('2d');
      ctx.fillStyle='#ebe5dc';ctx.fillRect(0,0,sheet.width,sheet.height);
      for(let i=0;i<values.length;i++){
        const img=new Image();img.src=values[i].file;
        await new Promise((ok,bad)=>{img.onload=ok;img.onerror=bad});
        const x=(i%4)*cw+9,y=Math.floor(i/4)*ch+8;
        ctx.fillStyle='#f5f0e6';ctx.fillRect(x,y,282,207);
        const z=Math.min(278/img.width,203/img.height);
        ctx.drawImage(img,x+(282-img.width*z)/2,y+(207-img.height*z)/2,
          img.width*z,img.height*z);
        ctx.fillStyle='#222';ctx.font='13px sans-serif';ctx.fillText(values[i].text,x,y+230);
      }
      return sheet.toDataURL('image/jpeg',.92).split(',')[1];
    },items);
    await writeFile(root+'/oil-v1-'+group+'-contact-sheet.jpg',Buffer.from(image,'base64'));
  }
  await writeFile(root+'/oil-v1-manifest.json',JSON.stringify({
    material:'Oil Paint V1 · deterministic Canvas2D renderer, not AI images',
    rendererFile:'js/oil-paint-v1.js',phiFraming:true,
    status:'experiment-only, no changes to live materials or publishing',images:result
  },null,2));
  console.log('PASS: 8 fixed, 8 random, 2 contact sheets, repeatability, source colours');
}finally{await browser.close()}
