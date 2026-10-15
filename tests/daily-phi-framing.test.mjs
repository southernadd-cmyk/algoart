// Regression for the exact London date when every new daily material adopts
// shared source-space φ framing. No social API calls or repository pushes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {dailyPhiFramingForDate,appendDailyPhiFraming} from '../automation/phi-framing.mjs';

const repo=process.cwd();
const date='2026-10-15';
const host=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
assert.equal(dailyPhiFramingForDate('2026-10-14'),false);
assert.equal(dailyPhiFramingForDate(date),true);
assert.equal(dailyPhiFramingForDate('2026-10-16'),true);
assert.throws(()=>dailyPhiFramingForDate('invalid date'));
assert.equal(appendDailyPhiFraming('v=8&seed=A','2026-10-14'),'v=8&seed=A');
assert.equal(new URLSearchParams(appendDailyPhiFraming('v=8&seed=A',date)).get('sheet'),'phi');
// Previously saved studies are not rewritten or silently attributed the
// newly introduced shared framing option.
const oldGallery=JSON.parse(await fs.readFile('gallery/2026-10-14/meta.json','utf8'));
const alreadyToday=JSON.parse(await fs.readFile('gallery/'+date+'/meta.json','utf8'));
const existingIds=new Set(alreadyToday.entries.map(e=>e.id));
const oldJson=JSON.stringify(oldGallery);
assert(oldGallery.entries.every(e=>!new URL(e.shareUrl).searchParams.has('sheet')),
  'Already published historical artwork must not change fit');
const workflow=await fs.readFile('.github/workflows/gallery-daily.yml','utf8');
assert(workflow.includes('npm run social:generate'));
assert(workflow.includes('GALLERY_QUEUE_MATERIAL: watercolour'));
assert(workflow.includes('GALLERY_QUEUE_MATERIAL: watercolor'));
const parent=await fs.readFile('.github/workflows/social-live.yml','utf8');
assert(parent.includes('watercolour-v2s-landscape:')&&parent.includes('watercolour-v2s-portrait:'));
const sample=[];
const cases=[
  {material:'marker',orientation:'landscape',expected:1},
  {material:'marker',orientation:'portrait',expected:1},
  {material:'watercolor',orientation:'landscape',expected:2},
  {material:'watercolor',orientation:'portrait',expected:2},
  {material:'watercolour',orientation:'landscape',expected:1},
  {material:'watercolour',orientation:'portrait',expected:1}
];
function run(file,env){
  const r=spawnSync(process.execPath,[path.join(repo,file)],{
    cwd:repo,encoding:'utf8',timeout:280000,maxBuffer:8*1024*1024,
    env:{...process.env,SOCIAL_DATE:date,SOCIAL_FORCE_MODE:'field',
      SOCIAL_SEED_SALT:'phi-date-regression',
      SOCIAL_COUNT:'1',...env}
  });
  assert.equal(r.status,0,file+' '+env.SOCIAL_MATERIAL+' '+env.SOCIAL_ORIENTATION+
    ' failed: '+r.stderr+'\n'+r.stdout.slice(-1500));
  console.log(r.stdout.split('\n').filter(x=>x.startsWith('Generated ')||x.startsWith('Built ')).join(' | '));
}
for(const c of cases){
  const orientation=c.orientation,material=c.material;
  run('automation/generate-social.mjs',{SOCIAL_MATERIAL:material,SOCIAL_ORIENTATION:orientation});
  const dir=path.join('social-output',date,...(
    material==='marker'?(orientation==='portrait'?['portrait']:[]):
      [material,orientation]));
  const queue=JSON.parse(await fs.readFile(path.join(dir,'queue.json'),'utf8'));
  assert.equal(queue.entries.length,c.expected);
  for(const entry of queue.entries){
    const url=new URL(entry.shareUrl);
    assert.equal(url.searchParams.get('sheet'),'phi',
      '15 October '+material+' '+orientation+' must use shared geometry');
    assert.equal(url.searchParams.get('seed'),entry.seed);
    assert.equal(url.searchParams.get('mode'),entry.mode);
    if(material==='watercolour'){
      assert.equal(url.searchParams.get('material'),'watercolour-v2s');
      assert.equal(url.searchParams.get('fit'),'0');
      assert.equal(entry.rendererVersion,9);
      assert.equal(entry.platforms.instagram.scheduledTime,'15:00');
    }else if(material==='watercolor'){
      assert.equal(url.searchParams.get('tissue'),'7');
    }else{
      assert.equal(url.searchParams.has('tissue'),false);
      assert.equal(url.searchParams.has('material'),false);
    }
    assert.equal(url.searchParams.get('fmt'),orientation==='portrait'?'portrait':null);
    await fs.access(path.join(dir,entry.imageFile));
    if(orientation==='portrait')await fs.access(path.join(dir,entry.instagramImageFile));
    sample.push({material,orientation,id:entry.id,seed:entry.seed,shareUrl:entry.shareUrl});
  }
  run('automation/build-gallery.mjs',{
    GALLERY_QUEUE_MATERIAL:material,GALLERY_QUEUE_ORIENTATION:orientation
  });
}
let gallery=JSON.parse(await fs.readFile(path.join('gallery',date,'meta.json'),'utf8'));
assert.equal(gallery.entries.length,existingIds.size+8,
  'Six material/format queues must append eight studies without deleting the existing daily gallery');
assert.equal(new Set(gallery.entries.map(e=>e.id)).size,existingIds.size+8,'No duplicate ids');
for(const id of existingIds)assert(gallery.entries.some(e=>e.id===id),
  'Previously archived 15 October study disappeared: '+id);
for(const entry of gallery.entries){
  assert.equal(new URL(entry.shareUrl).searchParams.get('sheet'),'phi');
  await fs.access(path.join('gallery',date,entry.imageFile));
}
run('automation/build-gallery.mjs',{GALLERY_QUEUE_MATERIAL:'watercolour',
  GALLERY_QUEUE_ORIENTATION:'portrait'});
gallery=JSON.parse(await fs.readFile(path.join('gallery',date,'meta.json'),'utf8'));
assert.equal(gallery.entries.length,existingIds.size+8,'Rebuilding same daily queue must not duplicate studies');
assert.equal(JSON.stringify(JSON.parse(await fs.readFile('gallery/2026-10-14/meta.json','utf8'))),
  oldJson,'Historical gallery JSON must remain unchanged');
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1250,height:880}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Validate short exact links for both canvas formats in all materials.
  for(const item of sample.filter(x=>x.material==='marker'||x.id.endsWith('01'))){
    const link=new URL(host);link.searchParams.set('art',item.id);
    await page.goto(link.href,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(seed=>document.getElementById('seed')?.value===seed,
      item.seed,{timeout:120000});
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('sheet')==='phi',
      null,{timeout:120000});
    assert.equal(new URL(page.url()).searchParams.get('sheet'),'phi',
      'Short editor link lost fit setting for '+item.material);
    const status=await page.evaluate(()=>({
      enabled:window.AlgoArt.phiFramingEnabled,
      kind:window.AlgoArt.lastPhiSheetFrame?.kind
    }));
    assert.equal(status.enabled,true);
    assert.equal(status.kind,'phi-sheet');
  }
  // A bare home URL also loads the most recent daily Marker cover. It
  // must retain exactly the same source-space framing as its gallery JPEG.
  const latestMarker=gallery.entries[0]; // The default cover is the first archived study, not a new test seed.
  await page.goto(host,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(seed=>document.getElementById('seed')?.value===seed,
    latestMarker.seed,{timeout:120000});
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('sheet')==='phi',
    null,{timeout:120000});
  assert.equal(new URL(page.url()).searchParams.get('sheet'),'phi',
    "Home editor must reproduce the same framed gallery cover");
  assert.equal(await page.locator('#phiSheetFit').isChecked(),true);
  assert.deepEqual(errors,[]);
}finally{await browser.close()}
console.log('PASS: 15 October 8 Marker/Tissue/Watercolour portrait/landscape artworks, shared phi source transform, exact editor links, stable gallery and historical cutoff.');
