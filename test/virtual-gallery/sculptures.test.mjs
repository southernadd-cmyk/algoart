import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLayout,canStand,DOOR_WIDTH} from '../../gallery/visit/layout-v2.mjs';
import {planGalleryHangs} from '../../gallery/visit/hanging-v3.mjs';
import {
  planGallerySculptures,planSculptureLayers,clearOfSculptures,
  validateSculpturePlacement,PEDESTAL_WIDTH,PEDESTAL_DEPTH,ENGINE_FORMS
} from '../../gallery/visit/sculptures.mjs';

const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'];
function exhibition(date,n,variant){
  const art=Array.from({length:n},(_,id)=>{
    const portrait=variant==='portrait'||(variant==='mixed'&&id%4>=2);
    return{id,seed:date+'-study-'+id,engine:modes[id%8],portrait,
      aspect:portrait?1/1.4:1.4};
  });
  return {art,layout:buildLayout(date,n,art)};
}
test('eight composition systems produce reproducible, different sculpture styles',()=>{
  assert.equal(Object.keys(ENGINE_FORMS).length,8);
  assert.equal(new Set(Object.values(ENGINE_FORMS)).size,8);
  for(const engine of modes){
    const study={seed:'PP-example-'+engine,engine};
    const layers=planSculptureLayers(study,'desktop');
    assert.equal(layers.length,11);
    assert.deepEqual(layers,planSculptureLayers(study,'desktop'));
    assert.equal(planSculptureLayers(study,'mobile').length,7);
    assert.equal(planSculptureLayers(study,'vr').length,8);
    assert.ok(layers.every((layer,i)=>layer.index===i && layer.count===11));
    assert.ok(new Set(layers.map(layer=>layer.depth)).size===11);
    assert.ok(layers.some(layer=>Math.abs(layer.shiftX)>.01 || Math.abs(layer.turn)>.02),
      engine+' lacks sculptural variation');
    assert.ok(layers.some(layer=>layer.isBacking),'sculpture needs a legible backing layer');
  }
});
test('all daily works are shown once: portrait = sculpture, landscape = wall piece',()=>{
  for(const date of ['2026-10-05','2026-10-18','2026-10-20','2026-10-21']){
    for(const n of [1,2,3,9,15,18,19,27]){
      for(const variant of ['mixed','portrait','landscape']){
        const {art,layout}=exhibition(date,n,variant);
        const walls=planGalleryHangs(layout,art);
        const sculptures=planGallerySculptures(layout,art);
        assert.equal(walls.length,art.filter(s=>!s.portrait).length);
        assert.equal(sculptures.length,art.filter(s=>s.portrait).length);
        assert.equal(walls.length+sculptures.length,art.length);
        const ids=[...walls,...sculptures].map(p=>p.studyId);
        assert.equal(new Set(ids).size,art.length,'artwork duplicated or missing');
        assert.ok(walls.every(p=>!art[p.studyId].portrait),'portrait incorrectly hung');
        assert.ok(sculptures.every(p=>art[p.studyId].portrait),'landscape incorrectly sculpted');
        assert.deepEqual(sculptures,planGallerySculptures(layout,art));
        assert.equal(validateSculpturePlacement(layout,sculptures),true);
        for(const room of layout.rooms){
          assert.ok(canStand(layout,room.x,room.z),'central visitor circulation lost');
          assert.ok(clearOfSculptures(sculptures,room.x,room.z),'central spine blocked by sculpture');
        }
      }
    }
  }
});
test('plinth footprints avoid both 3.8m doorway axes and are solid to visitor collision',()=>{
  const {art,layout}=exhibition('2026-10-21',18,'portrait');
  const sculptures=planGallerySculptures(layout,art);
  for(const s of sculptures){
    const room=layout.rooms[s.roomIndex],clearance=DOOR_WIDTH/2+.22;
    assert.ok(Math.abs(s.x-room.x)-PEDESTAL_WIDTH/2>clearance);
    assert.ok(Math.abs(s.z-room.z)-PEDESTAL_DEPTH/2>clearance);
    assert.equal(clearOfSculptures(sculptures,s.x,s.z),false);
    assert.ok(Math.abs(s.x-room.x)+PEDESTAL_WIDTH/2<room.width/2-.27);
    assert.ok(Math.abs(s.z-room.z)+PEDESTAL_DEPTH/2<room.depth/2-.27);
  }
});
test('same artwork seed reproduces its sculpture, a new seed changes the layers',()=>{
  const original={seed:'CWP-20261021-01-11221',engine:'spiral'};
  assert.notDeepEqual(planSculptureLayers(original),planSculptureLayers({...original,seed:'CWP-20261022-01-11221'}));
  const a=exhibition('2026-10-21',18,'mixed');
  const b=exhibition('2026-10-22',18,'mixed');
  assert.notDeepEqual(planGallerySculptures(a.layout,a.art),planGallerySculptures(b.layout,b.art));
});
