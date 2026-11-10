// Test ACTUAL frozen public release manifests, not just invented fixture queues.
// CI downloads the immutable November media release; never publishes or writes archives.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {validateActionItem} from '../automation/action-slot.mjs';
import {validateOilItem} from '../automation/oil-slot.mjs';
import {validateWatercolourItem} from '../automation/watercolour-slot.mjs';

const dir=process.env.PP_FROZEN_QUEUE_DIR;
if(!dir)throw Error('PP_FROZEN_QUEUE_DIR must point to downloaded release manifests');
const assets=new Set(JSON.parse(fs.readFileSync(path.join(dir,'assets.json'),'utf8')).assets.map(a=>a.name));
const cases=[
  ['action','2026-11-10','landscape',validateActionItem],
  ['action','2026-11-10','portrait',validateActionItem],
  ['watercolour','2026-11-09','landscape',validateWatercolourItem],
  ['watercolour','2026-11-09','portrait',validateWatercolourItem],
  ['oil','2026-11-09','landscape',validateOilItem],
  ['oil','2026-11-09','portrait',validateOilItem]
];
for(const [material,date,orientation,validate] of cases){
  test('actual frozen '+date+' '+material+' '+orientation+' is publishable with V10 and hosted originals',()=>{
    const filename=material+'-'+orientation+'-'+date+'-queue.json';
    assert.ok(assets.has(filename),'Monthly release is missing '+filename);
    const queue=JSON.parse(fs.readFileSync(path.join(dir,filename),'utf8'));
    assert.equal(queue.date,date);
    assert.equal(queue.material,material);
    assert.equal(queue.orientation,orientation);
    assert.equal(queue.entries.length,1);
    const item=queue.entries[0];
    assert.equal(item.rendererVersion,10);
    assert.equal(new URL(item.shareUrl).searchParams.get('v'),'10');
    assert.doesNotThrow(()=>validate(item,date,orientation));
    assert.ok(assets.has(item.imageFile),'Original frozen JPEG missing: '+item.imageFile);
    assert.ok(assets.has(item.instagramImageFile||item.imageFile),
      'Instagram-safe frozen JPEG missing: '+item.instagramImageFile);
  });
}
