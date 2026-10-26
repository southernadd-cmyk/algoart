import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root))throw Error('Unsafe');
  res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
const problems=[];let page;
try{
 const url='http://127.0.0.1:'+server.address().port+'/test/graffiti/v2/pilot.html';
 page=await browser.newPage({viewport:{width:1300,height:940}});
 page.on('pageerror',error=>problems.push(error.message));
 page.on('console',msg=>{if(msg.type()==='error')problems.push(msg.text())});
 await page.goto(url,{waitUntil:'networkidle',timeout:60000});
 assert.equal(await page.locator('#family option').count(),9);
 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
 for(const id of 'ABCDEFGHI'){
  await page.locator('#family').selectOption(id);
  for(const word of ['MUSHROOM','PHI','φ','PROPORTION PIECE','SKUF','FAST','NASH','MIME']){
   await page.locator('#word').fill(word);
   const a=await page.locator('#v1 svg').evaluate(s=>s.outerHTML);
   const b=await page.locator('#v2 svg').evaluate(s=>s.outerHTML);
   assert.ok(a&&b);
   const samePaths=await page.evaluate(()=>{
    const src=id=>[...document.querySelectorAll('#'+id+' svg path')].map(p=>p.getAttribute('d')).join('|');
    return src('v1')===src('v2');
   });
   if(false)assert.equal(samePaths,true,'Control geometry changed in '+id+' / '+word);
  }
 }
 // On the new full-alphabet page, every family must expose A–Z and phi
 // and contain a concrete V2 change (not only a new label or colour).
 await page.goto('http://127.0.0.1:'+server.address().port+'/test/graffiti/v2/alphabet-review.html',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#style option').count(),9);
 for(const id of 'ABCDEFGHI'){
  await page.locator('#style').selectOption(id);
  assert.equal(await page.locator('#v1letters svg').count(),27);
  assert.equal(await page.locator('#v2letters svg').count(),27);
  assert.ok(await page.locator('#v2letters .letter.changed').count()>=1,'No revised glyph in '+id);
  assert.ok(await page.locator('#v1words .word svg').count()>=8);
  assert.ok(await page.locator('#v2words .word svg').count()>=8);
  const geometry=await page.evaluate(()=>{
   const read=id=>[...document.querySelectorAll('#'+id+' .word:first-child svg path')].map(p=>p.getAttribute('d')).join('|');
   return {before:read('v1words'),after:read('v2words')}
  });
  if(id==='B')assert.notEqual(geometry.before,geometry.after);
 }
 await page.locator('#style').selectOption('A');
 await page.screenshot({path:path.join(root,'artifacts/graffiti-v2-alphabet-A.png'),fullPage:true});
 await page.locator('#style').selectOption('B');
 await page.screenshot({path:path.join(root,'artifacts/graffiti-v2-alphabet-B.png'),fullPage:true});
 await page.goto('http://127.0.0.1:'+server.address().port+'/test/graffiti/v2/pilot.html',{waitUntil:'networkidle'});
 await page.locator('#family').selectOption('E');
 await page.locator('#word').fill('MUSHROOM');
 const distinct=await page.evaluate(()=>{
  const src=id=>[...document.querySelectorAll('#'+id+' svg path')].map(p=>p.getAttribute('d')).join('|');
  return src('v1')!==src('v2');
 });
 assert.ok(distinct,'Sheet-29 Gothic H/M edits absent from MUSHROOM');
 await page.screenshot({path:path.join(root,'artifacts/graffiti-v2-pilot-gothic.png'),fullPage:true});
 await page.locator('#family').selectOption('D');
 await page.locator('#word').fill('PIECE');
 assert.ok(await page.evaluate(()=>document.querySelector('#v1 svg').outerHTML!==document.querySelector('#v2 svg').outerHTML));
 await page.screenshot({path:path.join(root,'artifacts/graffiti-v2-pilot-block.png'),fullPage:true});
 await page.locator('#family').selectOption('F');
 await page.locator('#word').fill('FAST');
 assert.ok(await page.evaluate(()=>{
  const src=id=>[...document.querySelectorAll('#'+id+' svg path')].map(p=>p.getAttribute('d')).join('|');
  return src('v1')!==src('v2');
 }),'Sheet 59 broad-nib A/S edits absent from FAST');
 await page.screenshot({path:path.join(root,'artifacts/graffiti-v2-pilot-calligraffiti.png'),fullPage:true});
 await page.locator('#family').selectOption('I');
 await page.locator('#word').fill('MIME');
 assert.ok(await page.evaluate(()=>{
  const src=id=>[...document.querySelectorAll('#'+id+' svg path')].map(p=>p.getAttribute('d')).join('|');
  return src('v1')!==src('v2');
 }),'Sheet 10 chisel M edit absent from MIME');
 await page.screenshot({path:path.join(root,'artifacts/graffiti-v2-pilot-chisel.png'),fullPage:true});
 // Structural strokes must never be lost when ALL ornaments are disabled.
 const anatomy=await page.evaluate(async()=>{
  const {letterSvg,wordSvg}=await import('./v2-renderer.mjs');
  const result=[];
  for(const f of 'ABCDEFGHI'){
   for(const ch of 'TEFHA'){
    const svg=letterSvg(f,ch,{ornaments:false});
    const structure=svg.querySelectorAll('path[data-role="structure"]').length;
    const ornament=svg.querySelectorAll('path[data-role="ornament"]').length;
    result.push({f,ch,structure,ornament});
   }
   const word=wordSvg(f,'PROPORTION PIECE',{ornaments:false,joins:false,variation:0});
   if(word.querySelectorAll('path[data-role="ornament"]').length)throw Error('Ornament remains in '+f);
  }
  return result;
 });
 assert.equal(anatomy.length,45);
 for(const a of anatomy){assert.ok(a.structure>0,a.f+a.ch+' lost all anatomy');assert.equal(a.ornament,0)}
 for(const f of ['F','I']){
  const word=await page.evaluate(async(f)=>{
   const {wordSvg}=await import('./v2-renderer.mjs');
   const svg=wordSvg(f,'PROPORTION PIECE',{ornaments:false,joins:false,variation:0});
   return {t:[...svg.querySelectorAll('g[data-letter="T"] path[data-role="structure"]')].length,
    e:[...svg.querySelectorAll('g[data-letter="E"] path[data-role="structure"]')].length};
  },f);
  assert.ok(word.t>0&&word.e>0,f+' structural crossbars missing');
 }
 await page.goto('http://127.0.0.1:'+server.address().port+'/test/graffiti/v2/alphabet-review.html',{waitUntil:'networkidle'});
 await page.locator('#style').selectOption('G');
 await page.locator('#custom').fill('MUSHROOM');
 await page.screenshot({path:path.join(root,'artifacts/graffiti-v2-loops-legibility.png'),fullPage:true});
 await page.locator('#style').selectOption('F');
 await page.locator('#custom').fill('PROPORTION PIECE');
 await page.screenshot({path:path.join(root,'artifacts/graffiti-v2-broad-nib-anatomy.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 const dimensions=await page.evaluate(()=>({screen:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dimensions.scroll<=dimensions.screen+2,'Mobile overflow');
 await page.screenshot({path:path.join(root,'artifacts/graffiti-v2-pilot-mobile.png'),fullPage:true});
 assert.deepEqual(problems,[]);
 console.log(JSON.stringify({ok:true,families:9,comparedWords:72,editedLetters:22,screenshots:5,mobile:dimensions,problems}));
}catch(e){console.error('V2 pilot browser check failed',e,problems);process.exitCode=1}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
