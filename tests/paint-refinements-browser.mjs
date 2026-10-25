import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/',out='paint-refinement-results';
const oldSources=['oil-v1-core-c','oil-paint-v1'].map(name=>({name,content:execFileSync('git',['show','d690b5844cb56be032505175bd3681690c0faabd:js/'+name+'.js'],{encoding:'utf8',maxBuffer:4e6})}));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),old=await browser.newPage();
 const errors=[];for(const p of [page,old])p.on('pageerror',e=>errors.push(e.message));
 // Substitute the original files before their first execution. Re-evaluating
 // core-c would wrap its composition planner twice and corrupt the baseline.
 for(const {name,content} of oldSources)await old.route('**/js/'+name+'.js*',route=>route.fulfill({contentType:'application/javascript',body:content}));
 await page.goto(root+'test/paint-refinements/');await old.goto(root+'test/paint-refinements/');
 const defaults=await page.evaluate(()=>window.paintStudy.settings('rects'));
 async function render(p,s,family,version,scale=.3,reveal=false){
  return p.evaluate(({s,family,version,scale,reveal})=>{
   const A=window.AlgoArt,c=document.createElement('canvas'),before=JSON.stringify(s),alphas=[],original=CanvasRenderingContext2D.prototype.drawImage,
    previousPlanner=A.planCompositionV5FromSource,previousContext=HTMLCanvasElement.prototype.getContext,previousCapture=A.materialStageCapture;
   let inConnections=false;
   A.materialStageCapture=function(label,...args){if(label==='oil-paint-base')inConnections=true;if(label==='oil-paint-connections')inConnections=false;previousCapture?.(label,...args)};
   CanvasRenderingContext2D.prototype.drawImage=function(...args){if(inConnections)alphas.push(this.globalAlpha);return original.apply(this,args)};
   let meta;
   try{meta=A['render'+(family==='oil'?'OilPaint':'ActionPainting')+'V'+version](c,s,scale,reveal)}
   finally{CanvasRenderingContext2D.prototype.drawImage=original;if(previousCapture===undefined)delete A.materialStageCapture;else A.materialStageCapture=previousCapture}
   const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let hash=2166136261,transparent=0;for(let i=0;i<data.length;i++){hash=Math.imul(hash^data[i],16777619);if(i%4===3&&data[i]!==255)transparent++}
   return {hash:hash>>>0,width:c.width,height:c.height,transparent,meta,
    action:family==='action'?A['lastActionPaintingStatsV'+version]:null,
    connectionAlpha:alphas.at(-1),inputIntact:JSON.stringify(s)===before,
    restored:!Object.hasOwn(A,'oilOpaquePaint')&&!A.oilPigmentActive&&A.planCompositionV5FromSource===previousPlanner&&HTMLCanvasElement.prototype.getContext===previousContext};
  },{s,family,version,scale,reveal});
 }
 const geometry=plan=>JSON.stringify(plan,(key,value)=>/rgb|palette|colour|color|paintTone|materialStats/i.test(key)?undefined:value);
 const rows=[];
 for(const orientation of ['landscape','portrait'])for(const mode of ['field','spiral','rects','burst','network','organic','geometric','scribble']){
  const s={...defaults,seed:'PAINT-STUDY-'+mode,mode,orientation,palette:mode==='geometric'||mode==='organic'?'neon':'warm'},label=mode+'-'+orientation;
  const v3=await render(page,s,'action',3),v4=await render(page,s,'action',4),v4again=await render(page,s,'action',4),v3after=await render(page,s,'action',3);
  assert.equal(v3.hash,v3after.hash,'Action V3 preserved '+label);assert.equal(v4.hash,v4again.hash,'Action V4 deterministic '+label);
  assert.notEqual(v3.hash,v4.hash,'Action study changes paint '+label);assert.deepEqual(v3.meta,v4.meta,'Same composition '+label);
  assert.equal(v3.action.pathCount,v4.action.pathCount);assert.equal(v3.action.anchorCount,v4.action.anchorCount);
  assert.equal(v4.action.palette.length,s.colourCount);if(mode==='rects')assert(v4.action.bowedSourceThrows>0,'Straight source throws detected '+label);
  const baseline=await render(old,s,'oil',5),v5=await render(page,s,'oil',5),v6=await render(page,s,'oil',6),v6again=await render(page,s,'oil',6),v5after=await render(page,s,'oil',5);
  assert.equal(v5.hash,baseline.hash,'Oil V5 original pixels '+label);assert.equal(v5after.hash,baseline.hash,'V5 after V6 '+label);
  assert.equal(v6.hash,v6again.hash,'Oil V6 deterministic '+label);assert.equal(geometry(v5.meta.plan),geometry(v6.meta.plan),'Oil geometry '+label);
  assert.deepEqual(v5.meta.work,v6.meta.work,'Oil brush counts '+label);
  if(v5.meta.plan.connectedFields.length)assert.notEqual(v5.hash,v6.hash,'Opaque field coverage changes paint '+label);
  if(v5.meta.work.oilV1.materialContacts>0){assert.notEqual(v5.hash,v6.hash,'Coverage changes pixels '+label);assert.equal(v5.connectionAlpha,.78);assert.equal(v6.connectionAlpha,1)}
  for(const result of [v3,v4,v3after,baseline,v5,v6,v5after]){
   assert(result.inputIntact&&result.restored,label+' scope');assert.equal(result.transparent,0);
   assert.equal(result.width,orientation==='portrait'?300:420);assert.equal(result.height,orientation==='portrait'?420:300);
  }
  rows.push({label,bowedThrows:v4.action.bowedSourceThrows,softenedRuns:v4.action.softenedStraightRuns,contacts:v6.meta.work.oilV1.materialContacts,actionV3:v3.hash,actionV4:v4.hash,oilV5:v5.hash,oilV6:v6.hash});
  console.log('PASS '+JSON.stringify(rows.at(-1)));
 }
 // Explicit Monochrome is the original palette; all counts stay user-chosen.
 for(const palette of ['mono','neon','primary','spectrum','golden'])for(const colourCount of [1,5,14]){
  const s={...defaults,palette,colourCount},v3=await render(page,s,'action',3,.2),v4=await render(page,s,'action',4,.2);
  assert.equal(v4.action.palette.length,colourCount);
  const mapped=await page.evaluate(({s,base})=>{
   if(s.palette==='mono')return base;
   const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');
   return base.map(css=>{ctx.fillStyle=css;ctx.fillRect(0,0,1,1);return 'rgb('+window.AlgoArt.oilPigment.mapRGB(Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3)).join(',')+')'});
  },{s,base:v3.action.palette});
  assert.deepEqual(v4.action.palette,mapped,'Exact shared pigment mapping '+palette+' '+colourCount);
 }
 // Shared connection hook preserves every historical oil branch in a fresh
 // render state, not only the current V5 studio path.
 for(const version of [1,2,3,4]){
  await page.reload();await old.reload();
  const s={...defaults,orientation:'portrait'},baseline=await render(old,s,'oil',version,.25),current=await render(page,s,'oil',version,.25);
  assert.equal(current.hash,baseline.hash,'Historical oil '+version+' pixels');console.log('PASS historical oil V'+version);
 }
 for(const orientation of ['landscape','portrait'])for(const [family,version] of [['action',4],['oil',6]]){
  const s={...defaults,orientation,palette:'neon'},a=await render(page,s,family,version,1,true),b=await render(page,s,family,version,1,true);
  assert.equal(a.hash,b.hash,'Full size/reveal '+family+' '+orientation);assert(a.restored&&b.restored);
  assert.equal(a.width,orientation==='portrait'?1000:1400);assert.equal(a.height,orientation==='portrait'?1400:1000);
 }
 // Save real comparisons of the exact cases called out in the review.
 for(const [material,mode,palette,orientation] of [['action','rects','warm','landscape'],['action','geometric','neon','portrait'],['action','spiral','primary','landscape'],['oil','organic','neon','landscape'],['oil','rects','earth','portrait']]){
  for(const [id,value] of Object.entries({material,mode,palette,orientation}))await page.selectOption('#'+id,value);
  await page.evaluate(()=>window.paintStudy.run());assert.equal(await page.locator('#results canvas').count(),2);
  await page.screenshot({path:out+'/'+material+'-'+mode+'-'+palette+'-'+orientation+'.png',fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
 const link=page.url();await page.reload();assert.equal(page.url(),link,'Study link preserves selections');
 assert.equal(await page.inputValue('#orientation'),'portrait');assert.equal(await page.inputValue('#material'),'oil');
 assert.deepEqual(errors,[],'Browser errors');await writeFile(out+'/results.json',JSON.stringify(rows,null,2));
 console.log('PASS 16 engine/orientation cases; historical pixel preservation; shared gamut and Monochrome; full-size/reveal; comparisons and mobile layout.');
}finally{await browser.close()}
