import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLayout, footprintAt, canStand} from '../gallery/visit/layout-v2.mjs';
import {planGalleryHangs} from '../gallery/visit/hanging-v3.mjs';
import {planGallerySculptures,validateSculpturePlacement} from '../gallery/visit/sculptures.mjs';

const engines=['field','spiral','rects','burst','network','organic','geometric','scribble'];
for(const date of ['2026-10-20','2026-10-24']){
  test('production architecture and hanging plans: '+date,()=>{
    const studies=Array.from({length:18},(_,index)=>({
      id:'art-'+index,seed:date+'-'+index,engine:engines[index%engines.length],
      portrait:index%3===0,aspect:index%3===0?1000/1400:1400/1000
    }));
    const layout=buildLayout(date,studies.length,studies);
    assert.deepEqual(layout,buildLayout(date,studies.length,studies));
    assert.equal(layout.rooms.length,6);
    assert.ok(layout.corridors.length>0);
    assert.ok(footprintAt(layout,layout.rooms[0].x,layout.rooms[0].z));
    assert.equal(canStand(layout,layout.rooms[0].x,layout.rooms[0].z),true);
    const sculpturePlans=planGallerySculptures(layout,studies);
    assert.equal(sculpturePlans.length,studies.filter(s=>s.portrait).length);
    assert.equal(validateSculpturePlacement(layout,sculpturePlans),true);
    const hangs=planGalleryHangs(layout,studies);
    assert.ok(Array.isArray(hangs));
  });
}
