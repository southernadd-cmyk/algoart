import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../../',import.meta.url));
const MIME={'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root))throw Error('Outside repo');
  res.setHeader('Content-Type',MIME[path.extname(file)]||'text/plain');
  res.end(await fs.readFile(file));
 }catch(error){res.writeHead(404);res.end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/test/graffiti/phase-d-alphabets.html';
const browser=await chromium.launch({headless:true});
const errors=[];
let page;
try{
 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
 page=await browser.newPage({viewport:{width:1366,height:960},deviceScaleFactor:1});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
 await page.goto(url,{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>document.querySelectorAll('.specimen').length===10);
 assert.equal(await page.locator('#compare article.specimen').count(),10);
 assert.equal(await page.locator('#family option').count(),10);
 assert.equal(await page.locator('#letters figure').count(),27);
 for(const figure of await page.locator('#letters figure').all())
  assert.ok(await figure.locator('svg path').count()>0,'Empty glyph');
 const previews=await page.locator('.word-preview svg').all();
 const imageHashes=[];
 for(const icon of previews){
  const png=await icon.screenshot({timeout:30000});
  imageHashes.push(createHash('sha256').update(png).digest('hex'));
 }
 assert.equal(new Set(imageHashes).size,10,'Two preview alphabets produce identical raster artwork');
 // Check construction changes, not just colour: custom commands must differ.
 const outlines=await page.locator('#compare .word-preview svg').evaluateAll(svgs=>svgs.map(s=>[...s.querySelectorAll('path')].map(p=>p.getAttribute('d')).join('|')));
 assert.equal(new Set(outlines).size,10,'Two families share identical geometry');
 await page.screenshot({path:path.join(root,'artifacts/graffiti-phase-d-comparison.png'),fullPage:true});
 for(const family of 'ABCDEFGHIJ'){
  await page.locator('#family').selectOption(family);
  assert.equal(await page.locator('#letters figure').count(),27,'Missing A–Z or phi glyph in '+family);
  assert.equal(await page.locator('#words > div').count(),5,'Missing word/phi samples '+family);
  const bounds=await page.locator('#letters svg').evaluateAll(svgs=>svgs.map(s=>{
   const bbox=s.querySelector('g[data-letter]')?.getBBox(),view=s.viewBox.baseVal;
   return {x:bbox.x,y:bbox.y,right:bbox.x+bbox.width,bottom:bbox.y+bbox.height,
    minX:view.x,maxX:view.x+view.width,minY:view.y,maxY:view.y+view.height};
  }));
  for(const b of bounds)assert.ok(b.x>=b.minX-1&&b.y>=b.minY-1&&b.right<=b.maxX+1&&b.bottom<=b.maxY+1,
   'Glyph exceeds SVG viewport in '+family+': '+JSON.stringify(b));
  await page.screenshot({path:path.join(root,'artifacts/graffiti-phase-d-'+family+'.png'),fullPage:true});
 }
 const phiSamples=await page.locator('#words > div[data-word="φ"] svg').count();
 assert.equal(phiSamples,1,'Standalone phi missing from preview');
 const wordBefore=await page.locator('#words > div').first().locator('svg').evaluate(s=>s.outerHTML);
 await page.locator('#family').selectOption('F');
 const nibPaths=await page.locator('#letters svg path[data-gesture="stroke"]').count();
 assert.ok(nibPaths>=20,'Broad-nib family missing generated stroke ribbons');
 await page.locator('#family').selectOption('I');
 assert.ok(await page.locator('#letters svg path[data-tool="chisel-marker"]').count()>=25,
  'Family I is still a plain skeletal font, not a chisel brush');
 await page.locator('#family').selectOption('J');
 await page.locator('#word').fill('PROPORTION PIECE');
 const joinedWord=await page.locator('#compare article[data-family="J"] .word-preview svg path[data-join]').count();
 assert.ok(joinedWord>=1,'Kinetic family has no contextual joins');
 await page.locator('#joins').selectOption('off');
 assert.equal(await page.locator('#compare .word-preview svg path[data-join]').count(),0,'Disabled joins still rendered');
 await page.locator('#joins').selectOption('on');
 assert.ok(await page.locator('#compare article[data-family="J"] .word-preview svg path[data-join]').count()>=1,
   'Re-enabling contextual joins failed');
 const phiWord=await page.evaluate(async()=> {
  const {wordSvg}=await import('./family-renderer.mjs');
  return [...'ABCDEFGHIJ'].map(id=>wordSvg(id,'φ').querySelectorAll('g[data-letter="Φ"]').length);
 });
 assert.deepEqual(phiWord,Array(10).fill(1),'Phi signatures absent from composition');
 await page.locator('#mode').selectOption('outline');
 assert.equal(await page.locator('#letters figure').count(),27);
 await page.locator('#word').fill('PROPORTION PIECE');
 assert.equal(await page.locator('#compare .specimen').count(),10);
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  page.locator('#export-word').click()
 ]);
 assert.match(download.suggestedFilename(),/graffiti-f-word\.svg$/);
 const out=await fs.readFile(await download.path(),'utf8');
 assert.match(out,/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(out,/viewBox=/);
 assert.ok((out.match(/<path/g)||[]).length>20);
 const [sheet]=await Promise.all([page.waitForEvent('download'),page.locator('#export-alphabet').click()]);
 const letters=await fs.readFile(await sheet.path(),'utf8');
 assert.ok((letters.match(/<path/g)||[]).length>=27,'Alphabet export missing original glyph geometry or phi');
 await page.setViewportSize({width:390,height:844});
 await page.locator('#mode').selectOption('ink');
 await page.locator('#word').fill('MUSHROOM');
 await page.locator('#family').selectOption('J');
 const mobile=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,
  figures:document.querySelectorAll('#letters figure').length,previews:document.querySelectorAll('.specimen').length,phi:document.querySelector('div[data-word="φ"] svg')!==null}));
 assert.ok(mobile.scrollWidth<=mobile.viewport+2,'Horizontal mobile overflow: '+JSON.stringify(mobile));
 assert.equal(mobile.figures,27);
 assert.equal(mobile.previews,10);
 assert.equal(mobile.phi,true);
 await page.screenshot({path:path.join(root,'artifacts/graffiti-phase-d-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[],'Browser console errors');
 console.log(JSON.stringify({ok:true,styles:10,letters:260,phiStyles:10,contextualJoins:true,uniqueRasterPreviews:new Set(imageHashes).size,
  uniqueVectorPreviews:new Set(outlines).size,mobile,errors,screenshots:12},null,2));
}catch(e){
 console.error('Phase D visual check failed',e,JSON.stringify(errors));
 if(page)await page.screenshot({path:path.join(root,'artifacts/graffiti-phase-d-failure.png'),fullPage:true}).catch(()=>{});
 process.exitCode=1;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
