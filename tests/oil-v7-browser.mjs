// Browser comparison for the isolated Oil V7 study; never changes editor defaults.
import {chromium,devices} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='oil-v7-results';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
const errors=[],reports=[];
const page=await browser.newPage({viewport:{width:1440,height:1050}});
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(root+'test/oil-v7/?manual=1');
 await page.waitForFunction(()=>typeof window.AlgoArt?.renderOilPaintV7==='function');
 const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'];
 const run=async(mode,orientation,scale)=>page.evaluate(({mode,orientation,scale})=>{
  const A=window.AlgoArt,s={...window.oilV7Defaults,seed:'OIL-V7-COMPARE-'+mode,mode,orientation};
  function hash(c){let h=2166136261;const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(const b of data)h=Math.imul(h^b,16777619);return h>>>0;}
  function render(n){const c=document.createElement('canvas'),start=performance.now(),meta=A['renderOilPaintV'+n](c,s,scale,false);
   const ms=performance.now()-start;return {ms,meta,c,hash:hash(c)};}
  // Alternate order after one warm-up of each version.
  render(6);render(7);
  const six=[],seven=[];let a,b;const hashes=[];
  for(let i=0;i<3;i++){
   if(i%2){b=render(7);a=render(6);}else{a=render(6);b=render(7);}
   six.push(a.ms);seven.push(b.ms);hashes.push(b.hash);
  }
  const sourceKey=m=>JSON.stringify({guide:m.guide,voids:m.voids,strategy:m.strategy,frame:m.phiSheetFrame});
  // V7 must not leak its active pigment/refinement/scratch state into V6.
  const repeat=render(6);
  const median=xs=>xs.sort((a,b)=>a-b)[1];
  document.getElementById('v6').width=a.c.width;document.getElementById('v6').height=a.c.height;
  document.getElementById('v6').getContext('2d').drawImage(a.c,0,0);
  document.getElementById('v7').width=b.c.width;document.getElementById('v7').height=b.c.height;
  document.getElementById('v7').getContext('2d').drawImage(b.c,0,0);
  const dimensions=[b.c.width,b.c.height];
  let painted=0;const data=b.c.getContext('2d').getImageData(0,0,...dimensions).data;
  for(let i=0;i<data.length;i+=4)if(Math.abs(data[i]-245)+Math.abs(data[i+1]-240)+Math.abs(data[i+2]-230)>45)painted++;
  return {mode,orientation,scale,v6Ms:median(six),v7Ms:median(seven),deterministic:hashes.every(h=>h===hashes[0]),
   legacyStable:a.hash===repeat.hash,sourceSame:sourceKey(a.meta)===sourceKey(b.meta),
   dimensions,paintCoverage:painted/(dimensions[0]*dimensions[1]),stats:b.meta.work,
   legacyPhases:a.meta.sourceMeta?.phases,adapterPlanFields:b.meta.plan.connectedFields.length,
   png6:a.c.toDataURL(),png7:b.c.toDataURL()};
 },{mode,orientation,scale});
 for(const [i,mode] of modes.entries()){
  const orientation=i%2?'portrait':'landscape';
  for(const scale of [.35,1]){
   const result=await run(mode,orientation,scale);
   const {png6,png7,...report}=result;
   report.speedup=report.v6Ms/report.v7Ms;reports.push(report);
   assert(report.deterministic,'V7 must replay deterministically: '+mode);
   assert(report.legacyStable,'V7 must not alter V6 output: '+mode);
   assert(report.sourceSame,'Source composition metadata must be preserved: '+mode);
   assert(report.paintCoverage>.01&&report.paintCoverage<.98,'Painting has meaningful occupied and blank areas: '+mode);
   assert.equal(report.stats.lightingPasses,1);assert.equal(report.stats.strokeReadbacks,0);
   const size=orientation==='portrait'?[1000,1400]:[1400,1000];
   assert.deepEqual(report.dimensions,size.map(x=>Math.round(x*scale)));
   if(scale===1){
    for(const [v,data] of [[6,png6],[7,png7]])await writeFile(out+'/'+mode+'-v'+v+'.png',Buffer.from(data.split(',')[1],'base64'));
    await page.locator('#status').evaluate((el,report)=>el.textContent=report.mode+': V6 '+report.v6Ms.toFixed(0)+' ms / V7 '+report.v7Ms.toFixed(0)+' ms ('+report.speedup.toFixed(2)+'×)',report);
    await page.screenshot({path:out+'/'+mode+'-comparison.jpg',fullPage:true,type:'jpeg',quality:75});
    if(['organic','rects','geometric'].includes(mode)){
     const preview=await page.screenshot({type:'jpeg',quality:65,fullPage:true});
     console.log('VISUAL_JPEG '+mode+' '+preview.toString('base64'));
    }
   }
   console.log('OIL_V7_RESULT '+JSON.stringify(report));
  }
 }
 // Framing + geometry reveal + export use the same version entry point.
 await page.evaluate(()=>{
  const A=window.AlgoArt,s={...window.oilV7Defaults,mode:'organic',orientation:'portrait',seed:'OIL-V7-FRAMED'};
  A.phiFramingEnabled=true;
  try{const c=document.createElement('canvas'),m=A.renderOilPaintV7(c,s,.5,true);
   if(!m.phiSheetFrame)throw Error('Missing phi frame');if(c.width!==500||c.height!==700)throw Error('Wrong framed dimensions');
  }finally{A.phiFramingEnabled=false;}
 });
 // Mobile viewport, actual controls and repeated PNG exports.
 const mobile=await browser.newContext({...devices['Pixel 7'],acceptDownloads:true});
 const p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(root+'test/oil-v7/?seed=OIL-V7-MOBILE&density=25');
 await p.waitForFunction(()=>!document.querySelector('#download').disabled,{},{timeout:120000});
 for(let i=0;i<2;i++){
  const [download]=await Promise.all([p.waitForEvent('download'),p.locator('#download').click()]);
  assert(download.suggestedFilename().endsWith('-oil-v7.png'));
  if(i===0){await p.locator('#seed').fill('OIL-V7-MOBILE-SECOND');await p.locator('#compare').click();await p.waitForFunction(()=>!document.querySelector('#download').disabled,{},{timeout:120000});}
 }
 await p.screenshot({path:out+'/mobile.jpg',fullPage:true});
 await mobile.close();
 assert.deepEqual(errors,[]);
}finally{
 await writeFile(out+'/report.json',JSON.stringify({reports,errors,note:'Warmed median of three; CPU Chromium on GitHub runner. Mobile viewport is emulation, not physical phone timing.'},null,2));
 await browser.close();
}
console.log('OIL_V7_SUMMARY '+JSON.stringify({cases:reports.length,medianSpeedup:reports.map(r=>r.speedup).sort((a,b)=>a-b)[Math.floor(reports.length/2)]}));

