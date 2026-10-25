// Full Action V3 release contract and five-material replay orientation checks.
// All posts and archive writes remain disabled; daily queues are local outputs.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {validateActionItem} from '../automation/action-slot.mjs';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/',out='action-v3-parity-results';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
try{
 const context=await browser.newContext({viewport:{width:1400,height:1000},acceptDownloads:true});
 await context.addInitScript(()=>{
  localStorage.setItem('algoart-intro-seen','1');localStorage.setItem('algoart-ethos-seen','1');localStorage.setItem('algoart-inspector-desktop','open');
  window.AlgoArt=window.AlgoArt||{};
  for(const name of ['renderActionPainting','renderActionPaintingV3']){
   let render;Object.defineProperty(window.AlgoArt,name,{configurable:true,get(){return render},set(fn){render=function(...args){
    const meta=fn.apply(this,args);
    if(args[0].id==='art')window.__actionRendered={version:name.endsWith('V3')?3:args[4]?.version||1,seed:args[1].seed};return meta;
   };}});
  }
 });
 const page=await context.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
 const seed='ACTION-V3-PARITY',params=new URLSearchParams({v:'9',seed,mode:'rects',el:'18',den:'40',pal:'primary',cols:'3',grain:'0'});
 async function ready(p,version){await p.waitForFunction(({seed,version})=>window.__actionRendered?.seed===seed&&window.__actionRendered?.version===version&&document.querySelector('#creatingOverlay')?.hidden===true,{seed,version},{timeout:180000})}
 async function exportTab(p){if(!await p.locator('#tab-export').isVisible())await p.locator('#inspectorToggle').click();await p.locator('#tab-export').click();await p.locator('#exportScale').selectOption('1')}
 async function hash(p){return p.locator('#art').evaluate(c=>{let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);return h>>>0})}
 async function pngHash(p,download){
  const bytes=await readFile(await download.path());assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
  return p.evaluate(async b64=>{const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),image=await createImageBitmap(new Blob([bytes],{type:'image/png'})),c=document.createElement('canvas');
   c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);image.close();return h>>>0;
  },bytes.toString('base64'));
 }
 async function replayReady(p,material,orientation){
  await p.waitForFunction(({material,orientation})=>{
   if(!window.__walkthroughTest||window.__walkthroughTest.settings().orientation!==orientation||document.querySelector('#replayMaterial').value!==material)return false;
   if(/^(Rendering|Calculating|Could not)/.test(document.querySelector('#notice').textContent))return false;
   if(material==='marker')return Number(document.querySelector('#step').max)>0;
   const last=window.__walkthroughTest.frames().at(-1);return last&&last.width/last.height===(orientation==='portrait'?320/448:448/320)&&Number(document.querySelector('#step').max)>0;
  },{material,orientation},{timeout:180000});
 }
 async function proportions(p,material,orientation){
  const data=await p.locator(material==='marker'?'#drawing':'#actionDrawing').evaluate(el=>{
   const box=el.getBoundingClientRect(),native=el instanceof SVGSVGElement?[el.viewBox.baseVal.width,el.viewBox.baseVal.height]:[el.width,el.height];
   return {native,display:[box.width,box.height],viewport:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  const expected=orientation==='portrait'?1000/1400:1400/1000;
  assert(Math.abs(data.native[0]/data.native[1]-expected)<.002,material+' native orientation');
  assert(Math.abs(data.display[0]/data.display[1]-expected)<.002,material+' displayed aspect ratio '+JSON.stringify(data));
  assert(data.display[1]<=data.viewport*.75+2,'Viewer exceeds height limit');assert(!data.overflow,'Mobile horizontal overflow');
 }
 let canonical,settings;
 for(const orientation of ['landscape','portrait']){
  const q=new URLSearchParams(params);if(orientation==='portrait')q.set('fmt','portrait');
  await page.goto(root+'?'+q,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AlgoArt?.readSettings&&document.querySelector('#creatingOverlay')?.hidden===true);
  if(!await page.locator('#tab-composition').isVisible())await page.locator('#inspectorToggle').click();await page.locator('#tab-composition').click();
  await page.locator('#materialStyle').selectOption('action');await ready(page,3);
  assert.equal(new URL(page.url()).searchParams.get('material'),'action-v3');const visible=await hash(page);
  await exportTab(page);const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#savePanel').click()]);
  assert(download.suggestedFilename().includes('-action-v3-1x.png'));assert.equal(await pngHash(page,download),visible,'Action V3 desktop PNG pixel parity '+orientation);
  canonical=page.url();settings=await page.evaluate(()=>window.AlgoArt.readSettings());
  const compact=await page.evaluate(()=>window.AlgoArt.socialShare.compact(location.href,Object.values(window.AlgoArt.PARAM_KEYS)));assert(new URL(compact).searchParams.has('c'));
  await page.goto(compact,{waitUntil:'domcontentloaded'});await ready(page,3);assert.equal(await hash(page),visible,'Compact Action V3 replay');
  const replayURL=await page.locator('#watchDrawing').getAttribute('href'),replay=await context.newPage();replay.on('pageerror',e=>errors.push(e.message));
  await replay.goto(new URL(replayURL,root).href,{waitUntil:'load'});await replayReady(replay,'action',orientation);await replay.locator('#all').click();
  await proportions(replay,'action',orientation);
  const parity=await replay.evaluate(()=>{
   const A=window.AlgoArt,s=window.__walkthroughTest.settings(),c=document.createElement('canvas');A.renderActionPaintingV3(c,s,.32,false,{version:3,layers:5});
   const final=window.__walkthroughTest.frames().at(-1),a=final.getContext('2d').getImageData(0,0,final.width,final.height).data,b=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let differences=0;for(let k=0;k<a.length;k++)if(a[k]!==b[k])differences++;return {differences,version:window.__walkthroughTest.materialVersion(),orientation:s.orientation};
  });assert.equal(parity.differences,0,'Action V3 walkthrough final frame');assert.equal(parity.version,'action-v3');
  assert.equal(new URL(await replay.locator('#continueEditing').getAttribute('href')).searchParams.get('material'),'action-v3');
  await replay.close();results.push({orientation,hash:visible});console.log('PASS Action V3 default, desktop PNG, compact link and walkthrough pixel parity '+orientation);
 }
 for(const version of [1,2]){
  const q=new URLSearchParams(params);q.set('material','action-v'+version);await page.goto(root+'?'+q,{waitUntil:'domcontentloaded'});await ready(page,version);
  assert.equal(new URL(page.url()).searchParams.get('material'),'action-v'+version);console.log('PASS historical Action V'+version+' studio link');
 }
 for(const [day,version] of [['2026-10-25',2],['2026-10-26',3]])for(const orientation of ['landscape','portrait']){
  const id=day+'-'+(orientation==='portrait'?'ACP':'ACL')+'01',url=new URL(canonical),s={...settings,orientation};url.searchParams.set('material','action-v'+version);
  if(orientation==='portrait')url.searchParams.set('fmt','portrait');else url.searchParams.delete('fmt');
  const entry={id,seed,mode:s.mode,material:'action',rendererVersion:9,settings:s,shareUrl:url.href};
  await page.route('**/gallery/'+day+'/meta.json',route=>route.fulfill({json:{date:day,entries:[entry]}}));
  await page.goto(root+'?art='+id,{waitUntil:'domcontentloaded'});await ready(page,version);assert.equal(new URL(page.url()).searchParams.get('material'),'action-v'+version);
  assert.equal(await page.locator('#materialStyle').inputValue(),'action');await page.unroute('**/gallery/'+day+'/meta.json');
  console.log('PASS archived Action V'+version+' '+orientation);
 }
 const engines=await page.evaluate(()=>{
  const A=window.AlgoArt,settings=A.readSettings(),results=[];
  for(const orientation of ['landscape','portrait'])for(const mode of ['field','spiral','rects','burst','network','organic','geometric','scribble']){
   const s={...settings,mode,orientation},hashes=[];
   for(let repeat=0;repeat<2;repeat++){
    const c=document.createElement('canvas');A.renderActionPaintingV3(c,s,.35,false,{version:3});let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);hashes.push(h>>>0);
   }results.push({mode,orientation,hashes});
  }return results;
 });for(const e of engines)assert.equal(e.hashes[0],e.hashes[1],JSON.stringify(e));console.log('PASS Action V3 deterministic rendering: eight engines × two orientations');
 // Every replay family keeps its native aspect ratio when switching formats.
 const replay=await context.newPage();replay.on('pageerror',e=>errors.push(e.message));const replayURL=new URL('about/step-by-step/',root);replayURL.search=new URL(canonical).search;
 await replay.goto(replayURL.href,{waitUntil:'load'});await replayReady(replay,'action','portrait');
 for(const material of ['marker','action','tissue','watercolour','oil'])for(const orientation of ['landscape','portrait']){
  await replay.selectOption('#replayMaterial',material);await replay.selectOption('#orientation',orientation);await replayReady(replay,material,orientation);await replay.locator('#all').click();await proportions(replay,material,orientation);
  const returned=new URL(await replay.locator('#continueEditing').getAttribute('href'));
  assert.equal(returned.searchParams.get('fmt'),orientation==='portrait'?'portrait':null);assert.equal(new URL(replay.url()).searchParams.get('fmt'),orientation==='portrait'?'portrait':null);
  assert.equal(returned.searchParams.get('seed'),seed);assert.equal(returned.searchParams.get('el'),'18');
  assert.equal(returned.searchParams.get('material'),({action:'action-v3',oil:'oil-v5',watercolour:'watercolour-v2s'})[material]||null);
  console.log('PASS replay display and return state '+material+' '+orientation);
 }
 await replay.screenshot({path:out+'/portrait-walkthrough.png',fullPage:true});
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 await mobile.addInitScript(()=>{localStorage.setItem('algoart-intro-seen','1');localStorage.setItem('algoart-ethos-seen','1');localStorage.setItem('algoart-inspector-mobile','open')});
 const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(canonical,{waitUntil:'domcontentloaded'});
 await mp.waitForFunction(()=>document.querySelector('#creatingOverlay')?.hidden===true&&document.querySelector('#materialStyle')?.value==='action',null,{timeout:180000});
 const mobileHash=await hash(mp);await exportTab(mp);await mp.locator('#savePanel').click();await mp.locator('#pngDownload').waitFor({state:'visible',timeout:180000});
 const [download]=await Promise.all([mp.waitForEvent('download'),mp.locator('#pngDownload').click()]);assert(download.suggestedFilename().includes('-action-v3-1x.png'));assert.equal(await pngHash(mp,download),mobileHash);console.log('PASS Action V3 mobile PNG pixel parity');
 await mp.goto(replayURL.href,{waitUntil:'load'});await replayReady(mp,'action','portrait');
 for(const orientation of ['landscape','portrait']){await mp.selectOption('#orientation',orientation);await replayReady(mp,'action',orientation);await mp.locator('#all').click();await proportions(mp,'action',orientation);}
 console.log('PASS mobile Action walkthrough portrait/landscape proportions');
 assert.deepEqual(errors,[],'Browser runtime errors');await writeFile(out+'/results.json',JSON.stringify({desktop:results,engines},null,2));
 for(const orientation of ['landscape','portrait']){
  const run=spawnSync(process.execPath,['automation/generate-social.mjs'],{encoding:'utf8',timeout:480000,maxBuffer:8e6,env:{...process.env,SOCIAL_DATE:'2026-10-26',SOCIAL_MATERIAL:'action',SOCIAL_ORIENTATION:orientation,SOCIAL_COUNT:'1'}});
  assert.equal(run.status,0,'New Action daily generation '+run.stderr+' '+run.stdout.slice(-1200));const q=JSON.parse(await readFile('social-output/2026-10-26/action/'+orientation+'/queue.json','utf8'));
  assert.equal(q.entries.length,1);validateActionItem(q.entries[0],'2026-10-26',orientation);assert.equal(new URL(q.entries[0].shareUrl).searchParams.get('material'),'action-v3');console.log('PASS real Action V3 daily generation '+orientation);
 }
 console.log('PASS complete Action V3 parity and walkthrough orientation checks.');
}finally{await browser.close()}
