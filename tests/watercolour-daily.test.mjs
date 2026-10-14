// Dry-run-only integration of V2S daily gallery and 15:00 publishing queues.
// Deliberately reuses the existing 14 October archive fixture locally, but
// NEVER pushes, uploads media or touches social APIs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {watercolourSlot,validateWatercolourItem} from '../automation/watercolour-slot.mjs';
import {makeCaptions,editorArtworkLink} from '../automation/captions.mjs';
const date='2026-10-14',host=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
assert.deepEqual(watercolourSlot('1'),{should_run:true,should_post:true,slot:'1',target_time:'15:00'});
assert.equal(watercolourSlot('build').should_post,false);
for(const slot of ['0','2','',null])assert.throws(()=>watercolourSlot(slot));
const historic=JSON.parse(await fs.readFile('gallery/'+date+'/meta.json','utf8'));
assert.equal(historic.entries.filter(e=>e.material==='watercolor').length,4);
assert.equal(historic.entries.filter(e=>e.material==='watercolour').length,0);
const before=new Map(historic.entries.map(e=>[e.id,JSON.stringify(e)]));
const queues=[];
function run(file,env){
  const r=spawnSync(process.execPath,[file],{
    cwd:process.cwd(),encoding:'utf8',timeout:360000,maxBuffer:16*1024*1024,
    env:{...process.env,SOCIAL_DATE:date,...env}
  });
  if(r.status!==0)throw Error(file+' failed: '+r.stderr+' '+r.stdout.slice(-2200));
  console.log(r.stdout.slice(-300));
}
for(const orientation of ['landscape','portrait']){
  const env={SOCIAL_MATERIAL:'watercolour',SOCIAL_ORIENTATION:orientation};
  run('automation/generate-social.mjs',env);
  const dir=path.join('social-output',date,'watercolour',orientation);
  const q=JSON.parse(await fs.readFile(path.join(dir,'queue.json'),'utf8'));
  assert.equal(q.material,'watercolour');assert.equal(q.orientation,orientation);
  assert.equal(q.entries.length,1);
  const item=q.entries[0];
  validateWatercolourItem(item,date,orientation);
  assert.equal(item.rendererVersion,9);
  assert.equal(item.settings.paper,'#f5f0e6');
  assert.equal(item.platforms.instagram.scheduledTime,'15:00');
  assert.equal(item.platforms.threads.scheduledTime,'15:00');
  assert.equal(item.platforms.bluesky.scheduledTime,'15:00');
  assert.match(item.seed,/^CW[LP]-20261014-01-\d{5}$/);
  assert.match(item.imageFile,/watercolour-(portrait|landscape)-01-/);
  await fs.access(path.join(dir,item.imageFile));
  if(orientation==='portrait'){
    assert.match(item.instagramImageFile,/-instagram\.jpg$/);
    await fs.access(path.join(dir,item.instagramImageFile));
  }
  assert.equal(new URL(item.shareUrl).searchParams.get('material'),'watercolour-v2s');
  assert.equal(new URL(item.shareUrl).searchParams.get('fit'),'0',
    'New Watercolour artwork must preserve φ source placement');
  const copy=makeCaptions(item);
  assert.match(copy.instagram,/WATERCOLOUR V2S/);
  assert.match(copy.altText,/Watercolour painting/);
  assert(editorArtworkLink(item).includes('?art='+item.id));
  queues.push(item);
  run('automation/build-gallery.mjs',{
    GALLERY_QUEUE_MATERIAL:'watercolour',GALLERY_QUEUE_ORIENTATION:orientation
  });
}
let after=JSON.parse(await fs.readFile('gallery/'+date+'/meta.json','utf8'));
assert.equal(after.entries.length,historic.entries.length+2);
assert.equal(after.entries.filter(e=>e.material==='watercolour').length,2);
assert.equal(after.entries.filter(e=>e.material==='watercolor').length,4);
for(const [id,old] of before) {
  const next=after.entries.find(e=>e.id===id);
  assert(next&&next.id===id,'Historical gallery id disappeared: '+id);
  const prev=JSON.parse(old);
  for(const key of ['seed','mode','series','imageFile','shareUrl','rendererVersion','settings'])
    assert.deepEqual(next[key],prev[key],'Historical '+key+' changed for '+id);
  await fs.access(path.join('gallery',date,prev.imageFile));
}
// Rebuilding the same queue is an idempotent merge, not an extra edition.
run('automation/build-gallery.mjs',{
  GALLERY_QUEUE_MATERIAL:'watercolour',GALLERY_QUEUE_ORIENTATION:'portrait'
});
after=JSON.parse(await fs.readFile('gallery/'+date+'/meta.json','utf8'));
assert.equal(after.entries.length,historic.entries.length+2);
assert.equal(new Set(after.entries.map(e=>e.id)).size,after.entries.length);
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1400,height:930}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const item of queues){
    const u=new URL(host);u.searchParams.set('art',item.id);
    await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(seed=>document.querySelector('#seed')?.value===seed,item.seed,{timeout:100000});
    const url=new URL(page.url());
    assert.equal(url.searchParams.get('material'),'watercolour-v2s');
    assert.equal(url.searchParams.get('fit'),'0');
    assert.equal(url.searchParams.get('fmt'),item.orientation==='portrait'?'portrait':null);
    assert.equal(await page.locator('#materialStyle').inputValue(),'watercolour');
    const dims=await page.locator('#art').evaluate(c=>[c.width,c.height]);
    assert.deepEqual(dims,item.orientation==='portrait'?[1000,1400]:[1400,1000]);
    assert.equal(url.searchParams.get('v'),'9');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
console.log('PASS two distinct V2S daily images; 15:00 slots; exact editor links; 14 existing studies immutable; repeated gallery merge safe');
