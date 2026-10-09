import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {scheduleDecision} from '../automation/portrait-slot.mjs';
import {PORTRAIT_SCHEDULE,PORTRAIT_POST_INDICES} from '../automation/config.mjs';

const day='2099-02-03';
const env={...process.env,SOCIAL_DATE:day,SOCIAL_COUNT:'5',SOCIAL_RENDERER_VERSION:'6'};
const node=(file,variables={})=>execFileSync(process.execPath,[file],{
  cwd:process.cwd(),env:{...env,...variables},encoding:'utf8',timeout:120000
});
for(const [utc,phase,slot] of [
  ['2026-10-09T04:20:00Z','skip',''],
  ['2026-10-09T05:20:00Z','build',''],
  ['2026-10-09T10:45:00Z','post',0],
  ['2026-10-09T16:45:00Z','post',1],
  ['2026-10-09T21:45:00Z','post',2],
  ['2027-01-09T06:20:00Z','build',''],
  ['2027-01-09T11:45:00Z','post',0],
  ['2027-01-09T17:45:00Z','post',1],
  ['2027-01-09T22:45:00Z','post',2]
]){
  const decision=scheduleDecision({date:new Date(utc)});
  assert.equal(decision.phase,phase,utc);
  assert.equal(decision.slot,slot,utc);
}
assert.deepEqual(PORTRAIT_POST_INDICES,[0,2,4]);
assert.deepEqual(PORTRAIT_SCHEDULE,['11:30','17:30','22:00']);

const queuePath=path.resolve('social-output',day,'portrait','queue.json');
node('automation/generate-social.mjs',{SOCIAL_ORIENTATION:'portrait'});
const portrait=JSON.parse(await fs.readFile(queuePath,'utf8'));
assert.equal(portrait.orientation,'portrait');
assert.equal(portrait.entries.length,5);
assert.equal(new Set(portrait.entries.map(x=>x.seed)).size,5);
assert.equal(new Set(portrait.entries.map(x=>x.imageFile)).size,5);
for(const [i,item] of portrait.entries.entries()){
  assert.equal(item.orientation,'portrait');
  assert.equal(item.settings.orientation,'portrait');
  assert.equal(new URL(item.shareUrl).searchParams.get('fmt'),'portrait');
  assert.ok(item.imageFile.includes('portrait-'));
  assert.equal(await fs.stat(path.resolve('social-output',day,'portrait',item.imageFile)).then(x=>x.size>1000),true);
  const planned=!!item.platforms.instagram;
  assert.equal(planned,[0,2,4].includes(i),'Unexpected portrait slot at '+i);
}
for(let slot=0;slot<3;slot++){
  const selected=execFileSync(process.execPath,['automation/portrait-slot.mjs','select'],{
    cwd:process.cwd(),env:{...env,SLOT:String(slot)},encoding:'utf8'
  });
  assert.ok(selected.includes('id='+portrait.entries[PORTRAIT_POST_INDICES[slot]].id));
  assert.ok(selected.includes('asset_name='+portrait.entries[PORTRAIT_POST_INDICES[slot]].imageFile));
}
node('automation/build-gallery.mjs',{GALLERY_QUEUE_ORIENTATION:'portrait'});
let meta=JSON.parse(await fs.readFile(path.resolve('gallery',day,'meta.json'),'utf8'));
assert.equal(meta.count,5,'Portrait-first gallery should contain five studies');

node('automation/generate-social.mjs',{SOCIAL_ORIENTATION:'landscape'});
const landscape=JSON.parse(await fs.readFile(path.resolve('social-output',day,'queue.json'),'utf8'));
assert.equal(landscape.entries.length,5,'Existing landscape base set changed');
assert.ok(landscape.entries.every(e=>!new URL(e.shareUrl).searchParams.has('fmt')));
node('automation/build-gallery.mjs',{GALLERY_QUEUE_ORIENTATION:'landscape'});
meta=JSON.parse(await fs.readFile(path.resolve('gallery',day,'meta.json'),'utf8'));
assert.equal(meta.count,10,'Gallery should combine five landscapes and five portraits');
assert.equal(meta.entries.filter(x=>x.orientation==='portrait').length,5);
assert.equal(meta.entries.filter(x=>x.orientation==='landscape').length,5);
assert.equal(new Set(meta.entries.map(x=>x.seed)).size,10);

node('automation/build-gallery.mjs',{GALLERY_QUEUE_ORIENTATION:'portrait'});
meta=JSON.parse(await fs.readFile(path.resolve('gallery',day,'meta.json'),'utf8'));
assert.equal(meta.count,10,'Rebuilding the same portrait day must not duplicate artworks');
assert.equal(meta.entries.filter(x=>x.orientation==='portrait').length,5);

console.log('PASS: five portraits, three unique posting slots, London BST/GMT timing, ten-work gallery and duplicate-safe rebuild.');
