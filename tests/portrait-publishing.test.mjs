import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {PORTRAIT_SCHEDULE,PORTRAIT_POST_INDICES,PLATFORM_SLOTS} from '../automation/config.mjs';
import {scheduleDecision} from '../automation/portrait-slot.mjs';

const repoRoot=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const date='2026-10-09';
assert.deepEqual(PORTRAIT_SCHEDULE,['09:00','15:00','20:30']);
assert.deepEqual(PORTRAIT_POST_INDICES,[0,2,4]);
assert.deepEqual(PLATFORM_SLOTS.instagram.slice(0,3),PORTRAIT_POST_INDICES);
const summer=[
  ['2026-10-09T07:59:00Z',false,null],
  ['2026-10-09T08:00:00Z',true,0],
  ['2026-10-09T14:00:00Z',true,1],
  ['2026-10-09T19:30:00Z',true,2]
];
const winter=[
  ['2026-12-09T08:59:00Z',false,null],
  ['2026-12-09T09:00:00Z',true,0],
  ['2026-12-09T15:00:00Z',true,1],
  ['2026-12-09T20:30:00Z',true,2]
];
for(const [iso,expected,slot] of [...summer,...winter]){
  const result=scheduleDecision({date:new Date(iso)});
  assert.equal(result.should_post,expected,iso);
  if(expected)assert.equal(result.slot,slot,iso);
}
assert.equal(scheduleDecision({force:'build'}).should_post,false);
for(let slot=0;slot<3;slot++){
  const result=scheduleDecision({force:String(slot)});
  assert.equal(result.slot,slot);
  assert.equal(result.target_time,PORTRAIT_SCHEDULE[slot]);
}

// Guard the orchestration itself, not just the individual slot calculator.
const parentWorkflow=await fs.readFile(path.join(repoRoot,'.github/workflows/social-live.yml'),'utf8');
const portraitWorkflow=await fs.readFile(path.join(repoRoot,'.github/workflows/portrait-live.yml'),'utf8');
assert.ok(parentWorkflow.includes('  portraits:\n'), 'Parent workflow must include a portrait job');
assert.ok(parentWorkflow.includes('needs: publish'), 'Landscape must finish before portraits');
assert.ok(parentWorkflow.includes('uses: ./.github/workflows/portrait-live.yml'), 'Portrait must reuse the parent workflow triggers');
assert.ok(parentWorkflow.includes('secrets: inherit'));
assert.ok(portraitWorkflow.includes('  workflow_call:'), 'Portrait must be a reusable workflow');
assert.ok(!portraitWorkflow.includes('\n  schedule:'), 'Portrait must not add duplicate cron triggers');
assert.ok(!portraitWorkflow.includes('\n  push:'), 'Portrait must not add a second push trigger');
assert.ok(portraitWorkflow.includes('portrait-slot'), 'Portrait must have separate post markers');
assert.ok(portraitWorkflow.includes('refs/heads/main')&&portraitWorkflow.includes('inputs.live == true'),
  'Feature branch must not publish publicly');
assert.ok(portraitWorkflow.includes('steps.cached.outputs.ready'), 'Later portrait posts must reuse the frozen batch');

const temp=await fs.mkdtemp(path.join(os.tmpdir(),'algoart-portrait-schedule-'));
try{
  const dayDir=path.join(temp,'social-output',date);
  const portraitDir=path.join(dayDir,'portrait');
  await fs.mkdir(portraitDir,{recursive:true});
  const landscape=Array.from({length:5},(_,index)=>({
    id:`${date}-${String(index+1).padStart(2,'0')}`,
    seed:`AA-${index}`,mode:'field',series:'Orbital Studies',
    imageFile:`landscape-${index}.jpg`,shareUrl:'https://example.com/?mode=field',
    rendererVersion:6,settings:{mode:'field',phiStrength:90,pen:'felt',palette:'mono'},
    copy:{altText:'Landscape'}
  }));
  const portraits=Array.from({length:5},(_,index)=>({
    id:`${date}-P${String(index+1).padStart(2,'0')}`,
    seed:`AP-${index}`,mode:'organic',series:'Growth Systems',
    orientation:'portrait',
    imageFile:`portrait-${index}.jpg`,
    instagramImageFile:`portrait-${index}-instagram.jpg`,
    shareUrl:'https://example.com/?mode=organic&fmt=portrait',
    rendererVersion:6,settings:{mode:'organic',orientation:'portrait',phiStrength:90,pen:'felt',palette:'mono'},
    copy:{altText:'Portrait',instagram:'Portrait on Instagram',threads:'Portrait on Threads',bluesky:'Portrait on Bluesky'}
  }));
  const json=(dir,entries,orientation)=>fs.writeFile(path.join(dir,'queue.json'),JSON.stringify({date,orientation,entries},null,2));
  await json(dayDir,landscape,'landscape');
  await json(portraitDir,portraits,'portrait');
  for(const item of landscape)await fs.writeFile(path.join(dayDir,item.imageFile),'fake-landscape');
  for(const item of portraits){
    await fs.writeFile(path.join(portraitDir,item.imageFile),'fake-portrait');
    await fs.writeFile(path.join(portraitDir,item.instagramImageFile),'fake-ig-portrait');
  }
  function run(script,env,args=[]){
    const r=spawnSync(process.execPath,[path.join(repoRoot,script),...args],{
      cwd:temp,env:{...process.env,GITHUB_OUTPUT:'',SOCIAL_DATE:date,...env},encoding:'utf8'
    });
    assert.equal(r.status,0,script+' failed: '+r.stderr+'\n'+r.stdout);
    return r.stdout;
  }
  function validateQueue(){
    return fs.readFile(path.join(temp,'gallery',date,'meta.json'),'utf8')
      .then(s=>JSON.parse(s));
  }
  // Running each queue in either order must preserve all ten artworks.
  run('automation/build-gallery.mjs',{GALLERY_QUEUE_ORIENTATION:'landscape'});
  run('automation/build-gallery.mjs',{GALLERY_QUEUE_ORIENTATION:'portrait'});
  let meta=await validateQueue();
  assert.equal(meta.entries.length,10);
  assert.equal(meta.entries.filter(e=>e.orientation==='portrait').length,5);
  assert.deepEqual(meta.entries.slice(0,5).map(e=>e.id),landscape.map(e=>e.id));
  assert.deepEqual(meta.entries.slice(5).map(e=>e.id),portraits.map(e=>e.id));
  assert.equal(meta.entries[5].settings.orientation,'portrait');
  const originalOrder=meta.entries.map(e=>e.id);
  run('automation/build-gallery.mjs',{GALLERY_QUEUE_ORIENTATION:'landscape'});
  run('automation/build-gallery.mjs',{GALLERY_QUEUE_ORIENTATION:'portrait'});
  meta=await validateQueue();
  assert.deepEqual(meta.entries.map(e=>e.id),originalOrder);
  for(const slot of [0,1,2]){
    const stdout=run('automation/portrait-slot.mjs',{SLOT:String(slot)},['select']);
    const selected=Object.fromEntries(stdout.trim().split('\n').map(row=>{
      const split=row.indexOf('=');return [row.slice(0,split),row.slice(split+1)];
    }));
    assert.equal(selected.id,portraits[PORTRAIT_POST_INDICES[slot]].id);
    assert.ok(selected.share_url.includes('fmt=portrait'));
    assert.equal(selected.asset_name,portraits[PORTRAIT_POST_INDICES[slot]].imageFile);
    assert.equal(selected.instagram_asset_name,portraits[PORTRAIT_POST_INDICES[slot]].instagramImageFile);
    assert.equal(selected.scheduled_time,PORTRAIT_SCHEDULE[slot]);
    const threadsCaption=Buffer.from(selected.threads_caption_b64,'base64').toString('utf8');
    assert.ok([...threadsCaption].length<=500,'Threads caption must fit the platform limit');
    assert.ok(threadsCaption.includes(`/?art=${portraits[PORTRAIT_POST_INDICES[slot]].id}`));
    const blueskyCaption=Buffer.from(selected.bluesky_caption_b64,'base64').toString('utf8');
    assert.ok(blueskyCaption.includes(`/?art=${portraits[PORTRAIT_POST_INDICES[slot]].id}`));
  }
  console.log('PASS: three existing slots (BST/GMT), five portrait artworks, three selections, stable ten-artwork gallery and Instagram 4:5 derivatives.');
}finally{
  await fs.rm(temp,{recursive:true,force:true});
}
