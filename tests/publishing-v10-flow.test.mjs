// End-to-end V10 publishing contract: five materials, both orientations,
// real browser-generated JPEGs, social captions and archived daily gallery.
// Synthetic future date only. Does NOT send a post, push, or change live files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {CURRENT_SOCIAL_RENDERER_VERSION} from '../automation/renderer-state.mjs';
import {makeCaptions,editorArtworkLink} from '../automation/captions.mjs';

const DAY='2099-11-09';
const ROOT=process.cwd();
const archiveFile=path.join('gallery',DAY,'meta.json');
assert.equal(CURRENT_SOCIAL_RENDERER_VERSION,10,'Daily/social default renderer must remain V10');
assert(!fs.existsSync(archiveFile),'Never overwrite an existing synthetic gallery fixture');

// The 8 Nov archive was made before the V10 release and must remain frozen.
const historicalPath='gallery/2026-11-08/meta.json';
const historicalBytes=fs.readFileSync(historicalPath);
const historical=JSON.parse(historicalBytes.toString('utf8'));
assert(historical.entries.some(e=>e.rendererVersion<10),'Missing archived V8/V9 control artwork');

// Verify every real scheduled material publishing route calls the common generator.
// No live workflow may silently pin an older renderer version.
for(const name of ['gallery-daily','social-live','portrait-live',
  'watercolor-live','watercolour-live','oil-live','action-live']){
  const source=fs.readFileSync('.github/workflows/'+name+'.yml','utf8');
  assert(source.includes('npm run social:generate'),
    name+' bypasses the shared renderer-aware daily/social generator');
  assert(!/^\s*SOCIAL_RENDERER_VERSION\s*:/m.test(source),
    name+' silently pins a renderer version');
}

function run(script,env) {
  const result=spawnSync(process.execPath,[script],{
    cwd:ROOT,encoding:'utf8',timeout:540000,maxBuffer:32*1024*1024,
    env:{...process.env,SOCIAL_DATE:DAY,SOCIAL_COUNT:'1',...env}
  });
  assert.equal(result.status,0,script+' '+env.SOCIAL_MATERIAL+' '+
    env.SOCIAL_ORIENTATION+' failed: '+(result.stderr||'').slice(-3000)+'\n'+
    (result.stdout||'').slice(-2000));
}

const materials=['marker','watercolor','watercolour','oil','action'];
const expectedRevisions={watercolour:'watercolour-v2s',oil:'oil-v8',action:'action-v4'};
const galleryRoot=path.join('gallery',DAY);
const saved=new Map();
for(const material of materials)for(const orientation of ['landscape','portrait']){
  const options={SOCIAL_MATERIAL:material,SOCIAL_ORIENTATION:orientation};
  run('automation/generate-social.mjs',options);
  const segments=[DAY,...(material==='marker'
    ?(orientation==='portrait'?['portrait']:[])
    :[material,orientation])];
  const dir=path.join('social-output',...segments);
  const queue=JSON.parse(fs.readFileSync(path.join(dir,'queue.json'),'utf8'));
  const expectedCount=material==='watercolor'?2:1;
  assert.equal(queue.date,DAY);
  assert.equal(queue.entries.length,expectedCount);
  assert.equal(queue.publishingEnabled,false,'Smoke test must never enable social posting');
  for(const item of queue.entries){
    const share=new URL(item.shareUrl);
    assert.equal(item.rendererVersion,10,item.id+' generated with old renderer');
    assert.equal(share.searchParams.get('v'),'10',item.id+' share link not V10');
    assert.equal(share.searchParams.get('seed'),item.seed);
    if(material==='watercolor')assert.equal(share.searchParams.get('tissue'),'7');
    if(expectedRevisions[material])
      assert.equal(share.searchParams.get('material'),expectedRevisions[material]);
    assert(item.copy.instagram.includes(editorArtworkLink(item)),
      item.id+' Instagram caption lost exact archived editor link');
    assert(item.copy.threads.includes(editorArtworkLink(item)),
      item.id+' Threads caption lost editor link');
    assert(item.copy.bluesky.includes(editorArtworkLink(item)),
      item.id+' Bluesky caption lost editor link');
    const original=fs.readFileSync(path.join(dir,item.imageFile));
    assert(original.length>10000,item.id+' lacks a real rendered JPEG');
    saved.set(item.id,{item,original,material,orientation});
  }
  run('automation/build-gallery.mjs',{
    ...options,GALLERY_QUEUE_MATERIAL:material,
    GALLERY_QUEUE_ORIENTATION:orientation
  });
  const meta=JSON.parse(fs.readFileSync(archiveFile,'utf8'));
  for(const item of queue.entries){
    const archived=meta.entries.find(e=>e.id===item.id);
    assert(archived,'Daily gallery omitted generated social artwork '+item.id);
    assert.equal(archived.rendererVersion,10);
    assert.equal(archived.shareUrl,item.shareUrl,'Archive link changed renderer/seed');
    assert.deepEqual(fs.readFileSync(path.join(galleryRoot,archived.imageFile)),
      saved.get(item.id).original,'Gallery JPEG differs from social image '+item.id);
  }
}
const meta=JSON.parse(fs.readFileSync(archiveFile,'utf8'));
assert.equal(meta.entries.length,12,'Expected 12 full-pipeline studies across 5 materials');
for(const material of materials){
  const subset=meta.entries.filter(e=>(e.material||'marker')===material);
  assert.equal(subset.length,material==='watercolor'?4:2,
    'Gallery missing '+material+' studies');
  for(const orientation of ['landscape','portrait'])
    assert(subset.some(e=>e.orientation===orientation),
      'Gallery missing '+orientation+' '+material);
}
// A later same-day queue rendered with an older engine must NOT repaint
// already published images, even if it reuses an archived seed and filename.
const frozen=JSON.parse(fs.readFileSync(archiveFile,'utf8'));
run('automation/generate-social.mjs',{
  SOCIAL_MATERIAL:'watercolor',SOCIAL_ORIENTATION:'landscape',
  SOCIAL_RENDERER_VERSION:'9'
});
const changedQueue=JSON.parse(fs.readFileSync(
  path.join('social-output',DAY,'watercolor','landscape','queue.json'),'utf8'));
assert(changedQueue.entries.every(e=>e.rendererVersion===9),
  'Recovery fixture did not produce a genuinely different renderer queue');
run('automation/build-gallery.mjs',{
  GALLERY_QUEUE_MATERIAL:'watercolor',GALLERY_QUEUE_ORIENTATION:'landscape'
});
const preserved=JSON.parse(fs.readFileSync(archiveFile,'utf8'));
assert.deepEqual(preserved.entries,frozen.entries,
  'A later generated queue replaced archived gallery renderer/URL state');
for(const {item,original} of saved.values())
  assert.deepEqual(fs.readFileSync(path.join(galleryRoot,item.imageFile)),original,
    'A later generated queue overwrote existing archive JPEG '+item.id);

assert.deepEqual(fs.readFileSync(historicalPath),historicalBytes,
  'Published V8/V9 historical archive was rewritten');
console.log('PASS: 12 browser-generated V10 social artworks across five materials and both formats; '+
  'exact gallery JPEG/share URL parity, caption links, and historical archive preserved.');
