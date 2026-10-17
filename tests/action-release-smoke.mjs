import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const pair=[];
for(const orientation of ['landscape','portrait']){
 const folder='social-output/2026-10-18/action/'+orientation;
 const queue=JSON.parse(await fs.readFile(folder+'/queue.json','utf8'));
 assert.equal(queue.material,'action');
 assert.equal(queue.orientation,orientation);
 assert.equal(queue.entries.length,1);
 for(const item of queue.entries){
  pair.push(item);
  assert.equal(item.material,'action');
  assert.equal(new URL(item.shareUrl).searchParams.get('material'),'action-v1');
  assert.match(item.id,/^2026-10-18-AC[LP]01$/);
  assert.match(item.copy.instagram,/ACTION PAINTING V1/);
  assert.equal(item.platforms.instagram.scheduledTime,'09:00');
  assert.equal(item.platforms.threads.scheduledTime,'09:00');
  assert.equal(item.platforms.bluesky.scheduledTime,'09:00');
  assert.ok(item.copy.bluesky.includes('?art='));
  await fs.access(folder+'/'+item.imageFile);
 }
}
console.log('Action Painting portrait and landscape social queues validated (release gate)');

assert.notEqual(pair[0].mode,pair[1].mode,'daily action modes must differ');
assert.notEqual(pair[0].settings.palette,pair[1].settings.palette,'daily action palettes must differ');
