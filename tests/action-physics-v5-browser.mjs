import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='action-physics-v5-results';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'test/action-physics-v5/',{waitUntil:'domcontentloaded'});
 const cases=[
  {seed:'PHYSICS-V5-RECTS',mode:'rects',palette:'warm',orientation:'landscape',phi:'91'},
  {seed:'PHYSICS-V5-GROWTH',mode:'organic',palette:'neon',orientation:'portrait',phi:'30'},
  {seed:'PHYSICS-V5-AUTOMATIC',mode:'scribble',palette:'earth',orientation:'landscape',phi:'0'}
 ],results=[];
 for(const [i,s] of cases.entries()){
  // select menus separately: avoids depending on selector-specific input APIs.
  for(const [id,value] of Object.entries(s)){
   if(['mode','palette','orientation'].includes(id))await page.selectOption('#'+id,value);
   else await page.locator('#'+id).fill(value);
  }
  const r=await page.evaluate(async()=>{
   const result=await window.actionPhysicsStudy.run();
   const hash=canvas=>{
    const a=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let h=2166136261;for(let i=0;i<a.length;i++)h=Math.imul(h^a[i],16777619);
    return h>>>0;
   };
   const a=hash(document.querySelector('#old')),b=hash(document.querySelector('#new')),
     A=window.AlgoArt,s=window.actionPhysicsStudy.settings(),other=document.createElement('canvas');
   A.renderActionPaintingV4(other,s,.5,false);
   const baselineAfter=hash(other);
   A.renderActionPaintingV5(other,s,.5,false);
   const v5Again=hash(other);
   return {oldHash:a,newHash:b,baselineAfter,v5Again,
    oldStats:result.oldStats,newStats:result.newStats,
    identicalMeta:JSON.stringify(result.oldMeta)===JSON.stringify(result.newMeta)};
  });
  assert(r.identicalMeta,'Both versions must use identical geometry '+s.seed);
  assert.equal(r.oldHash,r.baselineAfter,'V4 exact replay after rendering V5 '+s.seed);
  assert.equal(r.newHash,r.v5Again,'V5 exact replay '+s.seed);
  assert.notEqual(r.oldHash,r.newHash,'Paint effects must be visible '+s.seed);
  for(const key of ['pathCount','anchorCount','layers','skippedCrowded','bowedSourceThrows','softenedStraightRuns'])
   assert.equal(r.oldStats[key],r.newStats[key],'V4/V5 structural parity '+key+' '+s.seed);
  assert(r.newStats.dryBeads>0,'Depletion used '+s.seed);
  assert(r.newStats.speedDroplets>=0&&r.newStats.slowPools>=0);
  results.push({settings:s,...r});
  await page.screenshot({path:out+'/'+String(i+1).padStart(2,'0')+'-'+s.mode+'.png',fullPage:true});
  console.log('PASS '+s.seed+' '+JSON.stringify({v4:r.oldHash,v5:r.newHash,
   beads:r.newStats.dryBeads,droplets:r.newStats.speedDroplets,pools:r.newStats.slowPools}));
 }
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile overflow');
 assert.deepEqual(errors,[],'No browser errors');
 await writeFile(out+'/results.json',JSON.stringify(results,null,2));
 console.log('PASS V4 invariance, V5 determinism and geometry parity for 3 fixed studies.');
}finally{await browser.close()}
