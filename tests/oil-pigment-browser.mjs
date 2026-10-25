// Real engine comparison; no publishing or social actions. Baseline sources
// come from the base commit, so dormant hooks must preserve exact V4 pixels.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/',out='oil-pigment-results';
const modules=['random','phi','palettes','marker','phi-sheet-fit','generator',
 'oil-surface','oil-material','oil-render','oil-v1-core-a','oil-v1-core-b','oil-v1-core-c',
 'oil-paint-v1','oil-brush-v2','oil-paint-v2','oil-brush-v3','oil-paint-v3','cpu-canvas','cpu-material-versions'];
const baseline=process.env.OIL_BASE_REF||'origin/main';
// Read before launch: missing base refs/files fail immediately.
const source=modules.map(name=>execFileSync('git',['show',baseline+':js/'+name+'.js'],{encoding:'utf8',maxBuffer:4e6}));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1050}}),old=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));old.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'test/oil-pigment/',{waitUntil:'load'});
 await old.goto('about:blank');for(const content of source)await old.addScriptTag({content});
 await old.evaluate(()=>{window.AlgoArt.rendererVersion=9;window.AlgoArt.phiFramingEnabled=false});
 const settings=await page.evaluate(()=>window.oilPigmentStudy.settings('spiral'));
 const geometry=plan=>JSON.stringify(plan,(key,value)=>/rgb|palette|colour|color|paintTone|materialStats/i.test(key)?undefined:value);
 const rows=[];
 async function render(p,settings,version,scale=.35,reveal=false){
  return p.evaluate(({settings,version,scale,reveal})=>{
   const A=window.AlgoArt,c=document.createElement('canvas'),before=JSON.stringify(settings),native=HTMLCanvasElement.prototype.getContext,planner=A.planCompositionV5FromSource;
   const started=performance.now();
   const meta=/^v[1-4]$/.test(version)?A['renderOilPaintV'+version.slice(1)](c,settings,scale,reveal):A.renderOilPaintV5(c,settings,scale,reveal,{reference:version==='claude'});
   const renderMs=performance.now()-started;
   const rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let hash=2166136261,translucent=0;for(let i=0;i<rgba.length;i++){hash=Math.imul(hash^rgba[i],16777619);if(i%4===3&&rgba[i]!==255)translucent++}
   return {hash:hash>>>0,width:c.width,height:c.height,translucent,plan:meta.plan,pigment:meta.pigment,work:meta.work,
    sourcePaths:A.lastOilPaintV4EStats.sourcePaths,paintedPaths:A.lastOilPaintV4EStats.paintedPaths,massGroups:A.lastOilPaintV4EStats.massGroups,
    inputIntact:JSON.stringify(settings)===before,stateIntact:A.planCompositionV5FromSource===planner&&!A.oilPigmentActive&&HTMLCanvasElement.prototype.getContext===native,
    ms:+renderMs.toFixed(1)};
  },{settings,version,scale,reveal});
 }
 for(const orientation of ['landscape','portrait'])for(const mode of ['field','spiral','rects','burst','network','organic','geometric','scribble']){
  const s={...settings,mode,orientation,seed:'PIGMENT-REGRESSION-'+mode,palette:'golden'},label=mode+'-'+orientation;
  const before=await render(old,s,'v4'),current=await render(page,s,'v4'),developed=await render(page,s,'v5'),repeat=await render(page,s,'v5'),after=await render(page,s,'v4');
  assert.equal(current.hash,before.hash,'Old V4 pixels '+label);assert.equal(after.hash,before.hash,'V4 after V5 '+label);
  assert.equal(developed.hash,repeat.hash,'V5 repeatability '+label);assert.notEqual(developed.hash,current.hash,'V5 must change paint '+label);
  assert.equal(geometry(developed.plan),geometry(current.plan),'Source geometry '+label);
  for(const key of ['sourcePaths','paintedPaths','massGroups'])assert.equal(developed[key],current[key],key+' '+label);
  assert.deepEqual(developed.work,current.work,'Brush counts '+label);
  for(const r of [current,developed,repeat,after]){assert(r.inputIntact&&r.stateIntact,label+' state');assert.equal(r.translucent,0,label+' opacity')}
  assert(developed.pigment.mappedColours>0&&developed.pigment.tones>0,'Pigment hooks active '+label);
  rows.push({label,currentHash:current.hash,developedHash:developed.hash,currentMs:current.ms,developedMs:developed.ms,pigment:developed.pigment});console.log('PASS '+JSON.stringify(rows.at(-1)));
 }
 for(const version of ['v1','v2','v3']){
  const s={...settings,mode:'rects',orientation:'portrait'};
  const before=await render(old,s,version,.25),after=await render(page,s,version,.25);
  assert.equal(after.hash,before.hash,'Historical '+version+' unchanged');
  console.log('PASS historical '+version+' exact pixels after V5');
 }
 for(const [mode,orientation] of [['rects','landscape'],['organic','portrait']]){
  const s={...settings,mode,orientation},before=await render(old,s,'v4',1,true),current=await render(page,s,'v4',1,true),
   developed=await render(page,s,'v5',1,true),repeat=await render(page,s,'v5',1,true);
  assert.equal(current.hash,before.hash,'Full-size V4 unchanged '+orientation);
  assert.equal(developed.hash,repeat.hash,'Full-size V5 repeat '+orientation);
  assert.equal(geometry(developed.plan),geometry(current.plan),'Full-size geometry '+orientation);
  assert.equal(developed.width,orientation==='portrait'?1000:1400);assert.equal(developed.height,orientation==='portrait'?1400:1000);
  assert.equal(developed.translucent,0);assert(developed.stateIntact);
  console.log('PASS full-size with geometry reveal '+orientation);
 }
 // Visually inspect different palettes, including the bright-yellow and grey
 // cases that motivated the new gamut. These are real three-way renders.
 for(const [palette,mode,orientation] of [['golden','spiral','landscape'],['neon','network','portrait'],['primary','rects','landscape'],['mono','organic','portrait']]){
  await page.selectOption('#palette',palette);await page.selectOption('#mode',mode);await page.selectOption('#orientation',orientation);
  await page.evaluate(()=>window.oilPigmentStudy.run());
  await page.screenshot({path:out+'/'+palette+'-'+mode+'-'+orientation+'.png',fullPage:true});
  assert.equal(await page.locator('#results canvas').count(),3,'Three-way comparison renders');
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:out+'/mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
 assert.deepEqual(errors,[],'Browser console errors');
 await writeFile(out+'/results.json',JSON.stringify(rows,null,2));
 console.log('PASS all 16 engine/orientation cases; V1–V4 baseline pixels; full-size/reveal; geometry; state; repeatability; four visual comparisons; mobile layout.');
}finally{await browser.close()}
