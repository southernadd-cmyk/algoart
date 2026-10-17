// Four real browser watercolors, real JPEGs, exact state and gallery integration.
// Run against a locally served feature branch, never publish during this test.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
// Exercise the exact first seeded-colour publication day, not a generic future date.
const day='2026-10-14';
const site=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const outDir=path.resolve('watercolor-check-results');
await fs.mkdir(outDir,{recursive:true});
function run(file,env={},args=[]){
  const child=spawnSync(process.execPath,[file,...args],{
    cwd:process.cwd(),env:{...process.env,SOCIAL_DATE:day,SOCIAL_MATERIAL:'watercolor',...env},
    encoding:'utf8',timeout:360000,maxBuffer:32*1024*1024
  });
  if(child.status!==0)throw Error(file+': '+child.stderr+'\n'+child.stdout.slice(-2000));
  console.log(child.stdout.trim().slice(-350));
}
for(const orientation of ['landscape','portrait']){
  run('automation/generate-social.mjs',{SOCIAL_ORIENTATION:orientation});
  const dir=path.resolve('social-output',day,'watercolor',orientation);
  const q=JSON.parse(await fs.readFile(path.join(dir,'queue.json'),'utf8'));
  assert.equal(q.material,'watercolor');
  assert.equal(q.orientation,orientation);
  assert.equal(q.entries.length,2);
  for(const e of q.entries){
    assert.equal(e.material,'watercolor');
    assert.equal(e.orientation,orientation);
    assert.equal(e.rendererVersion,8);
    assert.equal(new URL(e.shareUrl).searchParams.get('tissue'),'6');
    assert.equal(new URL(e.shareUrl).searchParams.has('watercolor'),false);
    assert.equal(e.settings.paper,'#f5f0e6','New Tissue editions must use default neutral paper');
    assert.equal(new URL(e.shareUrl).searchParams.get('seed'),e.seed);
    assert(e.copy.altText.includes('Tissue and graphite'));
    assert((await fs.stat(path.join(dir,e.imageFile))).size>5000);
    assert((await fs.stat(path.join(dir,e.instagramImageFile))).size>5000);
  }
  run('tests/archive-reproduction.mjs',{},['--queue',path.join(dir,'queue.json')]);
  run('automation/build-gallery.mjs',{GALLERY_QUEUE_MATERIAL:'watercolor',GALLERY_QUEUE_ORIENTATION:orientation});
}
const meta=JSON.parse(await fs.readFile(path.resolve('gallery',day,'meta.json'),'utf8'));
// Existing mixed galleries already contain ten marker studies. Only the
// newly generated four Tissue editions should be asserted/opened here.
const watercolorEntries=meta.entries.filter(e=>e.material==='watercolor');
assert.equal(watercolorEntries.length,4);
assert.equal(meta.entries.filter(e=>e.orientation==='portrait'&&e.material==='watercolor').length,2);
assert.equal(meta.entries.filter(e=>e.orientation==='landscape'&&e.material==='watercolor').length,2);
// The standard Marker gallery must also keep the original cream paper on
// new days; its rendering material, seed algorithm and archive IDs are intact.
run('automation/generate-social.mjs',{
  SOCIAL_ORIENTATION:'landscape',SOCIAL_MATERIAL:'marker',SOCIAL_COUNT:'1'
});
const markerQueue=JSON.parse(await fs.readFile(path.resolve('social-output',day,'queue.json'),'utf8'));
assert.equal(markerQueue.entries[0].settings.paper,'#f5f0e6');
const b=await chromium.launch();
const page=await b.newPage({viewport:{width:1460,height:980}});
try{
 for(const e of watercolorEntries){
   const local=new URL(site);local.searchParams.set('art',e.id);
   const errors=[];page.on('pageerror',x=>errors.push(String(x)));
   await page.goto(local.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(seed=>{
     const q=new URLSearchParams(location.search);
     return q.get('seed')===seed && q.get('tissue')==='6' &&
       /tissue and graphite/i.test(document.querySelector('#statsText')?.textContent||'');
   },e.seed,{timeout:60000});
   assert.equal(await page.locator('#materialStyle').inputValue(),'tissue');
    assert.equal(await page.locator('#paper').inputValue(),'#f5f0e6');
   assert.equal(errors.length,0,errors.join(' | '));
   await page.locator('#art').screenshot({path:path.join(outDir,e.id+'.png')});
 }
}finally{await b.close()}
console.log('PASS: four new watercolor JPEGs and share links coexist with ten existing marker entries; exact archive pixels and short-link restoration.');
