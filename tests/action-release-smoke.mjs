import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
for(const orientation of ['landscape','portrait']){
 const folder='social-output/2026-10-18/action/'+orientation;
 const queue=JSON.parse(await fs.readFile(folder+'/queue.json','utf8'));
 assert.equal(queue.material,'action');
 assert.equal(queue.orientation,orientation);
 assert.equal(queue.entries.length,2);
 for(const item of queue.entries){
  assert.equal(item.material,'action');
  assert.equal(new URL(item.shareUrl).searchParams.get('material'),'action-v1');
  assert.match(item.id,/^2026-10-18-AC[LP]0[12]$/);
  assert.match(item.copy.instagram,/ACTION PAINTING V1/);
  assert.ok(item.copy.bluesky.includes('?art='));
  await fs.access(folder+'/'+item.imageFile);
 }
}
console.log('Action Painting portrait and landscape social queues validated (release gate)');
