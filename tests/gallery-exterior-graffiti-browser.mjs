import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const archive=JSON.parse(await fs.readFile(path.join(root,'gallery/tower-layouts.json'),'utf8'));
const dates=archive.floors.map(f=>f.date),latest=dates.at(-1);
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.gz':'application/octet-stream'};
// A partial local checkout can reuse unchanged public assets; CI has the full
// repository, so it reads the same files from disk without those redirects.
const server=http.createServer(async(req,res)=>{try{
 const name=decodeURIComponent(req.url.split('?')[0]);let file=path.join(root,name);
 if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
}catch{res.writeHead(302,{Location:'https://southernadd-cmyk.github.io/algoart'+req.url});res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const proxyURL=process.env.HTTPS_PROXY||process.env.HTTP_PROXY,p=proxyURL?new URL(proxyURL):null;
const proxy=p?{server:p.protocol+'//'+p.hostname+':'+p.port,bypass:'localhost,127.0.0.1',...(p.username?{username:decodeURIComponent(p.username),password:decodeURIComponent(p.password)}:{})}:undefined;
const executablePath=process.env.GALLERY_CHROMIUM;
const browser=await chromium.launch({headless:true,executablePath,proxy,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const origin=process.env.GALLERY_TEST_ORIGIN||'http://127.0.0.1:'+server.address().port;
await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
const identity=marks=>marks.map(m=>({id:m.id,date:m.date,phrase:m.phrase,hand:m.hand,form:m.form,face:m.face.id,width:m.width,height:m.height,rotation:m.rotation}));
function assertInterior(inside){
 assert.ok(inside.marks.length>=3&&inside.marks.length<=5);assert.equal(inside.diagnostics.errors.length,0);assert.equal(inside.diagnostics.painted,inside.marks.length);
 const occupied=new Set(inside.artWalls.map(h=>h.roomIndex+':'+h.surface));for(const m of inside.marks){assert.equal(m.form,'handstyle');assert.equal(m.surface,'interior');assert.ok(!occupied.has(m.face.id));assert.ok(m.width<=1.35001&&m.height<=.45001);}
 assert.ok(inside.marks.some(m=>m.rotation<0)&&inside.marks.some(m=>m.rotation>0));
 assert.equal(new Set(inside.marks.map(m=>m.hand)).size,inside.marks.length);
}
async function open({fallback=false,mobile=false,date=''}={}){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},deviceScaleFactor:1,ignoreHTTPSErrors:true,isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage(),errors=[],geometry=[],panoramaRequests=[];
 page.on('request',r=>{if(/day-environment-hdri/.test(r.url()))panoramaRequests.push(r.url());});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',async m=>{if(m.type()==='error'&&/Shader Error|WebGLProgram|paint failed|Missing upper floors/i.test(m.text()))errors.push(m.text());if(m.text().startsWith('[Gallery tower geometry]'))geometry.push(await m.args()[1].jsonValue());});
 if(fallback)await page.route('**/tower-geometry.bin.gz*',r=>r.fulfill({status:404,body:'Forced missing optional archive pack'}));
 const started=Date.now();await page.goto(origin+'/gallery/visit/?debug=1'+(date?'&date='+date:''),{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!document.getElementById('enter').disabled,null,{timeout:90000});
 const readyMs=Date.now()-started;
 await page.waitForFunction(()=>window.__galleryGraffiti?.diagnostics().pending===0&&window.__galleryInteriorGraffiti?.diagnostics().pending===0,null,{timeout:90000});
 const state=await page.evaluate(()=>({diagnostics:window.__galleryGraffiti.diagnostics(),marks:window.__galleryGraffiti.marks(),backdrop:window.__galleryBackdrop,inside:{diagnostics:window.__galleryInteriorGraffiti.diagnostics(),marks:window.__galleryInteriorGraffiti.marks(),artWalls:window.__galleryInteriorGraffiti.artWalls},aspect:document.getElementById('world').width/document.getElementById('world').height,cssAspect:document.getElementById('world').getBoundingClientRect().width/document.getElementById('world').getBoundingClientRect().height}));
 assertInterior(state.inside);assert.equal(state.diagnostics.errors.length,0);assert.equal(state.diagnostics.painted,state.marks.length);
 assert.equal(new Set(state.marks.map(m=>m.date)).size,Math.min(2,dates.length));
 for(const [level,date] of dates.entries())assert.equal(state.marks.filter(m=>m.date===date).length,level<2?10:0);
 assert.equal(state.backdrop.source,'procedural-city');assert.equal(state.backdrop.width,mobile?512:1024);assert.equal(state.backdrop.height,mobile?128:256);
 assert.deepEqual(new Set(state.marks.map(m=>m.phrase)),new Set(['Proportion Piece','PHI','φ']));
 for(const level of [0,1])assert.equal(new Set(state.marks.filter(m=>m.level===level).map(m=>m.hand)).size,9);
 assert.equal(state.diagnostics.pages,Math.ceil(state.marks.length/32));assert.ok(Math.abs(state.aspect-state.cssAspect)<.01);
 assert.ok(geometry.at(-1).maximumY>=geometry.at(-1).expectedMaximumY-2,'Occupied and archived floors must both contribute to the tower roofline');
 assert.deepEqual(panoramaRequests,[]);console.log(JSON.stringify({stage:'wall-ready',fallback,mobile,date,readyMs,geometry:geometry.at(-1),paint:state.diagnostics,interior:state.inside.diagnostics,backdrop:state.backdrop,errors}));
 return {page,context,state,errors,geometry,readyMs};
}
try{
 const main=await open();
 // CI source checkouts may omit the optional prepared tower archive. Its documented
 // procedural fallback must still produce the exact same graffiti plan and geometry.
 assert.ok(['prebuilt','procedural'].includes(main.geometry.at(-1).method));
 const exact=await main.page.evaluate(async()=>{
  const {createTag,drawTag}=await import('/test/graffiti/tag-engine.mjs?v=sprayed-throwups-v7');
  const {graffitiPaintParts}=await import('/gallery/visit/exterior-graffiti.mjs');
  const results=[];
  for(const form of ['bubble','hollow'])for(const hand of ['loop','sicoer','kadism'])for(const word of ['Proportion Piece','φ']){
   const tag=createTag(word,{form,hand}),b=tag.bounds;
   const paint=parts=>{const c=document.createElement('canvas');c.width=Math.ceil(b.width)+4;c.height=Math.ceil(b.height)+4;const g=c.getContext('2d');g.translate(-b.x+2,-b.y+2);for(const part of parts)drawTag(g,part,{finish:'spray'});return g.getImageData(0,0,c.width,c.height).data;};
   const a=paint([tag]),baked=paint(graffitiPaintParts(tag));results.push({form,hand,word,equal:a.every((v,i)=>v===baked[i])});
  }
  return results;
 });assert.ok(exact.every(r=>r.equal),'Painting letters in smaller steps must preserve final pixels: '+JSON.stringify(exact.filter(r=>!r.equal)));
 await main.page.locator('#enter').focus();await main.page.keyboard.press('Enter');
 await main.page.screenshot({path:path.join(root,'artifacts/tower-graffiti-exterior.png')});
 await main.page.locator('#openLift').click();
 await main.page.locator('#liftDays button[title^="'+latest+'"]').click();
 await main.page.waitForFunction(date=>location.search.includes(date)&&document.getElementById('liftAnimation').hidden,latest,{timeout:90000});
 const after=await main.page.evaluate(()=>({diagnostics:window.__galleryGraffiti.diagnostics(),marks:window.__galleryGraffiti.marks(),backdrop:window.__galleryBackdrop}));
 assert.equal(after.backdrop.textureId,main.state.backdrop.textureId);assert.equal(after.backdrop.cacheHit,true);assert.deepEqual(identity(after.marks),identity(main.state.marks));assert.deepEqual(after.diagnostics,main.state.diagnostics,'Lift travel must reuse the painted atlas');
 for(const date of [dates[1],dates[0]]){
  await main.page.locator('#openLift').click();await main.page.locator('#liftDays button[title^="'+date+'"]').click();
  await main.page.waitForFunction(date=>location.search.includes(date)&&document.getElementById('liftAnimation').hidden&&window.__galleryInteriorGraffiti.diagnostics().pending===0,date,{timeout:90000});
  const inside=await main.page.evaluate(()=>({diagnostics:window.__galleryInteriorGraffiti.diagnostics(),marks:window.__galleryInteriorGraffiti.marks(),artWalls:window.__galleryInteriorGraffiti.artWalls}));assertInterior(inside);
  assert.ok(inside.marks.every(m=>m.level===dates.indexOf(date)));
  if(date===dates[0])assert.deepEqual(identity(inside.marks),identity(main.state.inside.marks));
 }
 await main.page.evaluate(()=>window.__galleryInteriorGraffiti.preview(0));
 await main.page.locator('#world').screenshot({path:path.join(root,'artifacts/tower-interior-handstyle.png')});
 // Close-up of the actual archived/occupied wall meshes with the production shader.
 for(const [name,match] of [['brand',m=>m.phrase==='Proportion Piece'],['phi',m=>m.phrase==='φ'],['angle',m=>m.slot===0]]){
  const index=after.marks.findIndex(match);assert.ok(index>=0);
  await main.page.evaluate(index=>{document.getElementById('welcome').hidden=true;document.getElementById('lift').hidden=true;window.__galleryGraffiti.preview(index);},index);
  await main.page.locator('#world').screenshot({path:path.join(root,'artifacts/tower-graffiti-'+name+'.png')});
 }
 assert.deepEqual(main.errors,[]);await main.context.close();
 const fallback=await open({fallback:true});assert.equal(fallback.geometry.at(-1).method,'procedural');
 assert.deepEqual(identity(fallback.state.marks),identity(main.state.marks));assert.deepEqual(fallback.errors,[]);await fallback.context.close();
 const mobile=await open({mobile:true,date:latest});
 assert.deepEqual(identity(mobile.state.marks),identity(main.state.marks));assert.ok(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(mobile.errors,[]);
 await mobile.page.evaluate(()=>{document.getElementById('welcome').hidden=true;window.__galleryInteriorGraffiti.preview(0);});
 await mobile.page.screenshot({path:path.join(root,'artifacts/tower-graffiti-mobile.png')});await mobile.context.close();
 console.log(JSON.stringify({result:'passed',floors:dates.length,marks:main.state.marks.length,pages:main.state.diagnostics.pages,desktopReadyMs:main.readyMs,mobileReadyMs:mobile.readyMs,paint:main.state.diagnostics,checks:['prepared tower','procedural fallback','active upper floor','floor travel and atlas reuse','10 A–Z exterior marks on each of the two lower floors','3-5 small interior handstyles','entire painting walls excluded','phi positions and varied angles','no marks above first floor','no panorama request','cached generated backdrop','all requested words','outward geometry and shader','mobile aspect and layout'],errors:[]}));
}finally{await browser.close();server.close();}
