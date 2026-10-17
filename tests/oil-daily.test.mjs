// Oil Paint v1 daily gallery/social: actual browser dry run. No public posts,
// new schedules, GitHub release uploads, or production gallery writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {oilSlot,validateOilItem} from '../automation/oil-slot.mjs';
import {makeCaptions,editorArtworkLink,socialGraphemes} from '../automation/captions.mjs';
import {PALETTES} from '../automation/config.mjs';
const date='2026-10-15',host=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
assert.deepEqual(oilSlot('1'),{should_run:true,should_post:true,slot:'1',target_time:'15:00'});
assert.equal(oilSlot('build').should_post,false);
for(const slot of ['0','2','',null])assert.throws(()=>oilSlot(slot));
const historic=JSON.parse(await fs.readFile('gallery/'+date+'/meta.json','utf8'));
const before=new Map(historic.entries.map(e=>[e.id,JSON.stringify(e)]));
const originals=new Set(historic.entries.map(e=>e.imageFile));
const oilStudies=[];
function run(file,env){
  const r=spawnSync(process.execPath,[file],{
    cwd:process.cwd(),encoding:'utf8',timeout:480000,maxBuffer:16*1024*1024,
    env:{...process.env,SOCIAL_DATE:date,...env}
  });
  if(r.status!==0)throw Error(file+' failed: '+r.stderr+' '+r.stdout.slice(-3200));
  console.log(r.stdout.slice(-550));
}
for(const orientation of ['landscape','portrait']){
  const env={SOCIAL_MATERIAL:'oil',SOCIAL_ORIENTATION:orientation};
  run('automation/generate-social.mjs',env);
  const dir=path.join('social-output',date,'oil',orientation);
  const q=JSON.parse(await fs.readFile(path.join(dir,'queue.json'),'utf8'));
  assert.equal(q.material,'oil');assert.equal(q.orientation,orientation);
  assert.equal(q.entries.length,1);
  const item=q.entries[0];validateOilItem(item,date,orientation);
  assert.equal(item.rendererVersion,9);
  assert.equal(item.settings.paper,'#f5f0e6');
  assert.equal(item.platforms.instagram.scheduledTime,'15:00');
  assert.equal(item.platforms.threads.scheduledTime,'15:00');
  assert.equal(item.platforms.bluesky.scheduledTime,'15:00');
  assert.match(item.seed,/^O[LP]-20261015-01-\d{5}$/);
  assert.match(item.imageFile,/oil-(portrait|landscape)-01-/);
  assert(PALETTES.includes(item.settings.palette),'Oil chosen palette is not in source kit');
  assert(['organic','spiral','geometric'].includes(item.mode));
  assert.equal(new URL(item.shareUrl).searchParams.get('pal'),item.settings.palette);
  assert.equal(new URL(item.shareUrl).searchParams.get('material'),'oil-v1');
  assert.equal(new URL(item.shareUrl).searchParams.get('sheet'),'phi');
  await fs.access(path.join(dir,item.imageFile));
  await fs.access(path.join(dir,item.instagramImageFile||item.imageFile));
  const copy=makeCaptions(item);
  assert.match(copy.instagram,/OIL PAINT V1/);
  assert(copy.instagram.includes(item.settings.palette));
  assert(socialGraphemes(copy.threads)<=500);
  assert(socialGraphemes(copy.bluesky)<=300);
  assert(copy.threads.includes(editorArtworkLink(item)));
  assert(copy.bluesky.includes(editorArtworkLink(item)));
  assert.match(copy.altText,/Oil painting/);
  assert(editorArtworkLink(item).includes('?art='+item.id));
  oilStudies.push(item);
  run('automation/build-gallery.mjs',{
    GALLERY_QUEUE_MATERIAL:'oil',GALLERY_QUEUE_ORIENTATION:orientation
  });
}
assert.notEqual(oilStudies[0].seed,oilStudies[1].seed);
const gallery=JSON.parse(await fs.readFile('gallery/'+date+'/meta.json','utf8'));
assert.equal(gallery.entries.length,historic.entries.length+2);
assert.equal(gallery.entries.filter(e=>e.material==='oil').length,2);
assert.equal(new Set(gallery.entries.map(e=>e.id)).size,gallery.entries.length);
for(const [id,old] of before){
  const next=gallery.entries.find(e=>e.id===id);
  assert(next,'Historical artwork disappeared: '+id);
  const prev=JSON.parse(old);
  for(const key of ['seed','mode','series','imageFile','shareUrl','rendererVersion','settings'])
    assert.deepEqual(next[key],prev[key],'Historical archive data changed: '+id+'/'+key);
  await fs.access(path.join('gallery',date,prev.imageFile));
}
run('automation/build-gallery.mjs',{
  GALLERY_QUEUE_MATERIAL:'oil',GALLERY_QUEUE_ORIENTATION:'portrait'
});
const repeated=JSON.parse(await fs.readFile('gallery/'+date+'/meta.json','utf8'));
assert.deepEqual(repeated.entries.map(e=>e.id),gallery.entries.map(e=>e.id),
  'Rerunning the gallery duplicated or reordered Oil');
const html=await fs.readFile('gallery/'+date+'/index.html','utf8');
assert.equal((html.match(/data-material="oil"/g)||[]).length,2);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:950}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const item of oilStudies){
  const url=new URL(host);url.searchParams.set('art',item.id);
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:75000});
  await page.waitForFunction(seed=>document.querySelector('#seed')?.value===seed,
     item.seed,{timeout:105000});
  await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true&&new URL(location.href).searchParams.has('material'),{timeout:120000});
  const u=new URL(page.url());
  assert.equal(u.searchParams.get('material'),'oil-v1');
  assert.equal(u.searchParams.get('pal'),item.settings.palette);
  assert.equal(u.searchParams.get('sheet'),'phi');
  assert.equal(u.searchParams.get('v'),'9');
  assert.equal(u.searchParams.get('fmt'),item.orientation==='portrait'?'portrait':null);
  assert.equal(await page.locator('#materialStyle').inputValue(),'oil');
  const dims=await page.locator('#art').evaluate(c=>[c.width,c.height]);
  assert.deepEqual(dims,item.orientation==='portrait'?[1000,1400]:[1400,1000]);
  const plan=await page.evaluate(()=>{
    const A=window.AlgoArt;
    return A.planCompositionV5(A.readSettings(),{
      phiFraming:A.phiFramingEnabled===true,maxRegions:28}).broadConnectionStats?.count||0;
  });
  assert(plan>=2,'Social Oil link does not actually use connected broad paint fields');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close()}
console.log('PASS: 2 genuine randomly coloured Oil Paint v1 full-resolution studies; correct 15:00 links, immutable old gallery, idempotent writes and true source connections');


// Tomorrow's Oil V3 cutover: exercise real generation and gallery assembly.
const v3Date='2026-10-17';
for(const orientation of ['landscape','portrait']){
  const env={SOCIAL_DATE:v3Date,SOCIAL_MATERIAL:'oil',SOCIAL_ORIENTATION:orientation};
  run('automation/generate-social.mjs',env);
  const dir=path.join('social-output',v3Date,'oil',orientation);
  const queue=JSON.parse(await fs.readFile(path.join(dir,'queue.json'),'utf8'));
  assert.equal(queue.entries.length,1);
  const item=queue.entries[0];
  validateOilItem(item,v3Date,orientation);
  assert.equal(new URL(item.shareUrl).searchParams.get('material'),'oil-v4');
  assert.match(makeCaptions(item).instagram,/OIL PAINT V4/);
  run('automation/build-gallery.mjs',{
    SOCIAL_DATE:v3Date,GALLERY_QUEUE_MATERIAL:'oil',
    GALLERY_QUEUE_ORIENTATION:orientation
  });
}
const v3Gallery=JSON.parse(await fs.readFile('gallery/'+v3Date+'/meta.json','utf8'));
// The 17 October gallery already includes the scheduled second Oil studies.
// A dry run must preserve them, not assume the archive starts with zero Oil.
const oilEntries=v3Gallery.entries.filter(x=>x.material==='oil');
assert(oilEntries.length>=2,'Both Oil orientations must remain in the archive');
assert.equal(new Set(oilEntries.map(x=>x.id)).size,oilEntries.length,
  'Oil gallery dry run must not duplicate existing studies');
assert(oilEntries.some(x=>x.orientation==='landscape'||x.settings?.orientation!=='portrait'),
  'Oil gallery must include a landscape study');
assert(oilEntries.some(x=>x.orientation==='portrait'||x.settings?.orientation==='portrait'),
  'Oil gallery must include a portrait study');
assert(oilEntries.every(x=>['oil-v1','oil-v3','oil-v4'].includes(
  new URL(x.shareUrl).searchParams.get('material'))),
  'Existing gallery entries must retain their original Oil material versions');
const v3Html=await fs.readFile('gallery/'+v3Date+'/index.html','utf8');
assert(v3Html.includes('Oil Paint'),'17 October gallery must identify Oil artworks');
console.log('PASS: 17 October portrait and landscape Oil V3 generation, captions and gallery');
