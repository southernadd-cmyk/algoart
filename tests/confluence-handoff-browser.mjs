import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// Verify real editor-to-Confluence button clicks across all five materials.
// The shared three-artist composition intentionally differs from solo.
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
  v:'10',seed:'CONFLUENCE-TISSUE-V8-AUDIT',mode:'burst',
  material:'tissue-v8',pal:'warm',fmt:'landscape',el:'58',den:'63',
  phi:'38.2',th:'17',wob:'29',cols:'12',sat:'73',
  paper:'#e6d5cc',grain:'27',ln:'0',ci:'1',sheet:'phi'
 });
 await page.goto(origin+'/?'+state.toString(),{waitUntil:'load'});
 const visible=await page.locator('#introSplash').isVisible();
 if(visible)await page.locator('#introEnter').click();
 await page.waitForFunction(()=>
  window.AlgoArt?.lastTissueV8Stats?.variant==='layered-v8',
  null,{timeout:90000});
 assert.equal(await page.locator('#exploreConfluence').count(),1,
   'Verified Explore in Confluence button is missing');
 const solo=await page.evaluate(()=>({
  seed:document.querySelector('#seed').value,
  material:document.querySelector('#materialStyle').value,
  mode:document.querySelector('#mode').value,
  v8:window.AlgoArt?.lastTissueV8Stats?.variant,
  link:location.href
 }));
 assert.equal(solo.seed,'CONFLUENCE-TISSUE-V8-AUDIT');
 assert.equal(solo.material,'tissue');
 assert.equal(solo.mode,'burst');
 assert.equal(solo.v8,'layered-v8');
 const url=new URL(solo.link);
 assert.equal(url.searchParams.get('material'),'tissue-v8',
   'Solo renderer must identify V8 in its saved state');
 // Click the actual solo-editor control.
 const importedUrl=new URL(await page.locator('#exploreConfluence').getAttribute('href'),origin);
 assert.equal(importedUrl.pathname,'/confluence/');
 assert.equal(importedUrl.searchParams.get('material'),'tissue-v8');
 assert.equal(importedUrl.searchParams.get('seed'),solo.seed);
 await page.locator('#exploreConfluence').click();
 await page.waitForURL(/\/confluence\/\?/,{timeout:90000});
 await page.waitForFunction(()=>
  document.querySelector('#import-note')?.hidden===false &&
  document.querySelector('#seed')?.value==='CONFLUENCE-TISSUE-V8-AUDIT',
  null,{timeout:90000});
 const imported=await page.evaluate(()=>({
  material:document.querySelector('.artist[data-artist="1"] select[data-field="material"]')?.value,
  system:document.querySelector('.artist[data-artist="1"] select[data-field="system"]')?.value,
  palette:document.querySelector('.artist[data-artist="1"] select[data-field="palette"]')?.value,
  grain:document.getElementById('grain').value,
  orientation:document.getElementById('orientation').value,
  hasV8Renderer:typeof window.AlgoArt?.renderTissueLayeredV8==='function',
  tissueVersion:window.AlgoArt?.lastOilMaterialStats?.tissuePaletteVersion||null,
  v8Variant:window.AlgoArt?.lastTissueV8Stats?.variant,
  v8Version:window.AlgoArt?.lastTissueV8Stats?.tissuePaletteVersion,
  hasV8Stats:!!window.AlgoArt?.lastTissueV8Stats
 }));
 assert.equal(imported.material,'tissue','The source Tissue material must transfer');
 assert.equal(imported.system,'burst','Radiant Systems must transfer');
 assert.equal(imported.palette,'warm');
 assert.equal(imported.grain,'27');
 assert.equal(imported.orientation,'landscape');
 // The full-sheet solo entry point is deliberately not used: Confluence
 // paints spatially transformed gestures, but its V8 material stages must
 // be active. Visitors can now evaluate the resulting shared interpretation.
 console.log('TISSUE_V8_HANDOFF_AUDIT '+JSON.stringify({
  solo:{material:solo.material,system:solo.mode,renderer:solo.v8},
  confluence:imported
 }));
 assert.equal(imported.hasV8Renderer,false,
  'Do not generate a separate solo sheet in place of Confluence turns');
 assert.equal(imported.hasV8Stats,true,
  'Confluence did not execute the released Tissue V8 material stages');
 assert.equal(imported.v8Variant,'layered-v8');
 assert.equal(imported.v8Version,8);
 // The four remaining material choices must survive the same real
 // editor URL state round-trip, not merely pass a unit-level parser test.
 // The specific Tissue V8 material-physics check runs separately.
 for(const [material,expected] of [
   ['marker','marker'],['watercolour-v2s','watercolour'],
   ['oil-v8','oil'],['action-v4','action']
 ]){
   const seed='CONFLUENCE-HANDOFF-'+expected.toUpperCase();
   const request=new URLSearchParams({
     v:'10',seed,mode:'burst',material,pal:'warm',
     fmt:'portrait',el:'42',den:'58',phi:'47.5',th:'12',
     cols:'8',sat:'64',paper:'#e6d5cc',grain:'27'
   });
   await page.goto(origin+'/?'+request.toString(),{waitUntil:'load'});
   if(await page.locator('#introSplash').isVisible())
     await page.locator('#introEnter').click();
   await page.waitForFunction(([value,kind])=>
     document.querySelector('#seed')?.value===value &&
     document.querySelector('#materialStyle')?.value===kind,
     [seed,expected],{timeout:90000});
   assert.equal(await page.locator('#exploreConfluence').count(),1,
     'Verified solo-editor CTA is missing for '+material);
   const current=new URL(page.url());
   assert.equal(current.searchParams.get('seed'),seed);
   // Marker deliberately uses an omitted default material query value.
   if(material!=='marker')assert.equal(current.searchParams.get('material'),material);
   const target=new URL(await page.locator('#exploreConfluence')
     .getAttribute('href'),origin);
   assert.equal(target.pathname,'/confluence/');
   assert.equal(target.searchParams.get('seed'),seed);
   if(material!=='marker')assert.equal(target.searchParams.get('material'),material);
   await page.locator('#exploreConfluence').click();
   await page.waitForURL(/\/confluence\/\?/,{timeout:90000});
   await page.waitForFunction(value=>
     document.querySelector('#import-note')?.hidden===false &&
     document.querySelector('#seed')?.value===value,seed,{timeout:90000});
   const after=await page.evaluate(()=>({
     material:document.querySelector('.artist[data-artist="1"] select[data-field="material"]')?.value,
     system:document.querySelector('.artist[data-artist="1"] select[data-field="system"]')?.value,
     palette:document.querySelector('.artist[data-artist="1"] select[data-field="palette"]')?.value,
     elements:document.querySelector('.artist[data-artist="1"] input[data-setting="elements"]')?.value,
     colourCount:document.querySelector('.artist[data-artist="1"] input[data-setting="colourCount"]')?.value,
     paper:document.querySelector('#paper')?.value,
     orientation:document.querySelector('#orientation')?.value
   }));
   assert.equal(after.material,expected);
   assert.equal(after.system,'burst');
   assert.equal(after.palette,'warm');
   assert.equal(after.elements,'42');
   assert.equal(after.colourCount,'8');
   assert.equal(after.paper,'#e6d5cc');
   assert.equal(after.orientation,'portrait');
   console.log('SOLO_CONFLUENCE_MATERIAL_HANDOFF '+JSON.stringify({material,after}));
 }
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
