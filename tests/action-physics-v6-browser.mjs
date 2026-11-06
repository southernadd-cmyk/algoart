import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='action-physics-v6-results';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'],
 palettes=['warm','neon','earth','cold','golden','mono','pastel','primary'],
 cases=[
  {seed:'PHYSICS-V5-RECTS',mode:'rects',palette:'warm',orientation:'landscape',phi:91,elements:36},
  {seed:'PHYSICS-V5-GROWTH',mode:'organic',palette:'neon',orientation:'portrait',phi:30,elements:36},
  {seed:'PHYSICS-V5-AUTOMATIC',mode:'scribble',palette:'earth',orientation:'landscape',phi:0,elements:36}
 ];
for(let i=0;i<modes.length;i++)for(let j=0;j<2;j++)for(const phi of [0,50,100]){
 cases.push({seed:'V6-MATRIX-'+modes[i]+'-'+j+'-'+phi,
 mode:modes[i],orientation:j?'portrait':'landscape',phi,
 palette:palettes[(i+j+phi/50)%palettes.length],elements:36});
}
for(const [i,mode] of ['field','rects','organic','scribble'].entries())
 cases.push({seed:'V6-SPARSE-'+i,mode,palette:palettes[i],
 orientation:i%2?'portrait':'landscape',phi:[0,30,60,100][i],elements:5});
const page=await browser.newPage({viewport:{width:1800,height:1100}}),
 errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(root+'test/action-physics-v6/',{waitUntil:'domcontentloaded'});
 for(const [index,s] of cases.entries()){
  const r=await page.evaluate(async ({s,checkReplay})=>{
   const ids=['seed','mode','palette','orientation','phi','elements'];
   for(const id of ids)document.getElementById(id).value=String(s[id]);
   document.getElementById('quality').value='.3';
   const result=await window.actionPhysicsStudy.run();
   const base=result.panel.v4,old=result.panel.v5,now=result.panel.v6;
   const info={settings:s,checks:result.checks,
    pixelV4:base.pixel,pixelV5:old.pixel,pixelV6:now.pixel,
    timeV4:base.timeMs,timeV5:old.timeMs,timeV6:now.timeMs,
    totalPaintV4:now.stats.throwMass.reduce((acc,t)=>acc+t.reference,0),
    totalPaintV6:now.stats.throwMass.reduce((acc,t)=>acc+t.current,0),
    worstPathBudgetDeviation:Math.max(0,...now.stats.throwMass.map(t=>Math.abs(t.changePercent))),
    throwCount:now.stats.throwMass.length,
    deposits:{dryBeads:now.stats.dryBeads,speedDroplets:now.stats.speedDroplets,slowPools:now.stats.slowPools},
    structuralParity:result.structuralDecisionsIdentical,metadataParity:result.geometryIdentical};
   if(checkReplay){
    const A=window.AlgoArt,c=document.createElement('canvas'),pixel=window.actionPhysicsStudy.measure;
    A.renderActionPaintingV4(c,window.actionPhysicsStudy.settings(),.3,false);
    info.v4ReplayedHash=pixel(c).hash;
    A.renderActionPaintingV6(c,window.actionPhysicsStudy.settings(),.3,false);
    info.v6ReplayedHash=pixel(c).hash;
   }
   return info;
  },{s,checkReplay:index<8||index>=cases.length-4});
  assert(r.structuralParity&&r.metadataParity,'Geometry parity '+s.seed);
  assert(r.throwCount>0,'Throws generated '+s.seed);
  assert(r.worstPathBudgetDeviation<=3,'Path budget '+s.seed+': '+r.worstPathBudgetDeviation);
  if(r.v4ReplayedHash!==undefined){
   assert.equal(r.v4ReplayedHash,r.pixelV4.hash,'V4 hash unchanged '+s.seed);
   assert.equal(r.v6ReplayedHash,r.pixelV6.hash,'V6 deterministic '+s.seed);
  }
  results.push(r);
  if(index<3||index>=cases.length-4)
   await page.screenshot({path:out+'/'+String(index+1).padStart(2,'0')+'-'+s.mode+'.png',fullPage:true});
  console.log((r.checks.every(x=>x.passed)?'TARGETS PASS ':'TARGETS NOT MET ')+
   s.seed+' '+JSON.stringify(r.checks.map(c=>[c.name,Number(c.value?.toFixed(2)),c.passed])));
 }
 await page.setViewportSize({width:390,height:850});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Portrait/mobile layout must not clip');
 assert.deepEqual(errors,[],'Browser errors');
 const byGate={};
 for(const row of results)for(const check of row.checks){
  const k=check.name;if(!byGate[k])byGate[k]={passed:0,failed:0,worstDeviation:0};
  byGate[k][check.passed?'passed':'failed']++;
  byGate[k].worstDeviation=Math.max(byGate[k].worstDeviation,Math.abs(check.value??Infinity));
 }
 const report={cases:results.length,byGate,allAccepted:results.every(x=>x.checks.every(k=>k.passed)),
  manualReview:'Pools must be legible at 100% viewing; inspect screenshots/full-resolution page',
  thresholds:{ink:3,heavy:5,saturation:2,pathMass:3,renderOverheadMs:10},results};
 await writeFile(out+'/results.json',JSON.stringify(report,null,2));
 console.log('WIDE MATRIX: '+JSON.stringify({cases:report.cases,allAccepted:report.allAccepted,byGate}));
 // Intentionally keep technical integrity separate from acceptance: the
 // screenshots/metrics must remain accessible even when aesthetic gates fail.
}finally{await browser.close()}
