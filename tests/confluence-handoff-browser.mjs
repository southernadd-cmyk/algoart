import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// End-to-end public navigation and solo-to-Confluence handoff. This verifies
// the rendered solo state, not just a mock seed URL or a static link.
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=resolve(root,'.'+pathname);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return}
  if(pathname.endsWith('/'))file=resolve(file,'index.html');
  const body=await readFile(file);
  res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream',
    'cache-control':'no-store'}).end(body);
 }catch(e){res.writeHead(404).end('Not found')}
});
let browser;
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const state=new URLSearchParams({
  v:'10',seed:'CONFLUENCE-INTEGRATION-01',mode:'organic',
  material:'marker',pal:'warm',fmt:'portrait',el:'58',den:'63',
  phi:'38.2',th:'17',wob:'29',cols:'12',sat:'73',
  paper:'#e6d5cc',grain:'27',ln:'0',ci:'1',sheet:'phi'
 });
 await page.goto(origin+'/?'+state.toString(),{waitUntil:'load'});
 await page.waitForFunction(()=>{
  const link=document.getElementById('exploreConfluence');
  return link?.href.includes('/confluence/?') &&
    link.href.includes('CONFLUENCE-INTEGRATION-01');
 },{timeout:45000});
 let source=await page.locator('#exploreConfluence').getAttribute('href');
 const url=new URL(source,origin);
 assert.equal(url.pathname,'/confluence/');
 for(const [key,expected] of state.entries()){
  if(key==='v')continue;
  assert.equal(url.searchParams.get(key),expected,
    'Solo handoff lost '+key+'='+expected);
 }
 // The editor's splash must not obstruct a visitor taking the link.
 if(await page.locator('#introSplash').isVisible())
  await page.locator('#introEnter').click();
 await page.locator('#exploreConfluence').click();
 await page.waitForURL(/\/confluence\/\?/,{timeout:45000});
 await page.waitForFunction(()=>
  document.getElementById('shared-seed')?.textContent.includes('CONFLUENCE-INTEGRATION-01'),
  {timeout:60000});
 const imported=await page.evaluate(()=>({
  seed:document.getElementById('seed').value,
  paper:document.getElementById('paper').value,
  orientation:document.getElementById('orientation').value,
  grain:document.getElementById('grain').value,
  lead:document.getElementById('lead-index').value,
  note:!document.getElementById('import-note').hidden,
  first:[...document.querySelectorAll('.artist')][0],
  firstSystem:document.querySelector('.artist[data-artist="1"] select[data-field="system"]')?.value,
  firstMaterial:document.querySelector('.artist[data-artist="1"] select[data-field="material"]')?.value,
  firstPalette:document.querySelector('.artist[data-artist="1"] select[data-field="palette"]')?.value,
  firstElements:document.querySelector('.artist[data-artist="1"] input[data-setting="elements"]')?.value,
  firstColours:document.querySelector('.artist[data-artist="1"] input[data-setting="colourCount"]')?.value,
  secondSystem:document.querySelector('.artist[data-artist="2"] select[data-field="system"]')?.value,
  thirdSystem:document.querySelector('.artist[data-artist="3"] select[data-field="system"]')?.value
 }));
 assert.equal(imported.note,true,'Destination never identified the imported solo drawing');
 assert.equal(imported.seed,'CONFLUENCE-INTEGRATION-01');
 assert.equal(imported.paper,'#e6d5cc');
 assert.equal(imported.orientation,'portrait');
 assert.equal(imported.grain,'27');
 assert.equal(imported.lead,'0');
 assert.equal(imported.firstSystem,'organic');
 assert.equal(imported.firstMaterial,'marker');
 assert.equal(imported.firstPalette,'warm');
 assert.equal(imported.firstElements,'58');
 assert.equal(imported.firstColours,'12');
 assert.equal(imported.secondSystem,'spiral','Second artist should remain independent');
 assert.equal(imported.thirdSystem,'organic','Third artist should remain independent');
 console.log('SOLO_CONFLUENCE_HANDOFF '+JSON.stringify({
  seed:imported.seed,material:imported.firstMaterial,
  system:imported.firstSystem,palette:imported.firstPalette
 }));

 // All four links must remain within the viewport and not overlap at narrow
 // widths; no navigation destination is silently omitted on mobile.
 for(const pathname of ['/confluence/','/','/gallery/','/about/','/about/step-by-step/']){
  if(new URL(page.url()).pathname!==pathname)
    await page.goto(origin+pathname,{waitUntil:'domcontentloaded'});
  for(const width of [320,390,480,768,1280]){
   await page.setViewportSize({width,height:844});
   const result=await page.evaluate(()=>{
    const links=[...document.querySelectorAll('.algo-site-nav [data-algo-nav]')];
    const rects=links.map(el=>{
     const r=el.getBoundingClientRect();
     return {text:el.textContent.trim(),left:r.left,right:r.right,
       top:r.top,bottom:r.bottom,width:r.width,height:r.height}
    });
    const collisions=[];
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
      const a=rects[i],b=rects[j];
      if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)
        collisions.push(a.text+' / '+b.text);
    }
    return {width:innerWidth,rects,collisions};
   });
   assert.equal(result.rects.length,4,pathname+' has the wrong number of nav entries');
   assert.deepEqual(result.collisions,[],
     pathname+' nav collision at '+width+': '+JSON.stringify(result));
   for(const rect of result.rects)
    assert(rect.width>0&&rect.left>=-1&&rect.right<=width+1,
      pathname+' nav clipped at '+width+': '+JSON.stringify(result));
  }
  console.log('FOUR_LINK_NAV '+pathname+' PASS');
 }
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
