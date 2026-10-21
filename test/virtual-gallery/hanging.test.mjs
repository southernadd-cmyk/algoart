import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayout, DOOR_WIDTH, ROOM_HEIGHT } from './layout.mjs';
import { planRoomHangs, planGalleryHangs } from './hanging.mjs';

function fixture(date, count, pattern = 'mixed') {
  const modes = ['rects','spiral','network','organic','field','burst','geometric','scribble'];
  const studies = Array.from({ length: count }, (_, id) => ({
    id, seed: `${date}-${id}-${modes[id % modes.length]}`,
    engine: modes[id % modes.length],
    portrait: pattern === 'portrait' ? true : pattern === 'landscape' ? false : (id % 4 >= 2),
    aspect: pattern === 'portrait' || (pattern === 'mixed' && id % 4 >= 2) ? 1/1.4 : 1.4
  }));
  const layout = buildLayout(date, count, studies);
  return { studies, layout };
}
function verify(room, hangs) {
  const byWall = new Map();
  for (const h of hangs) {
    assert.equal(h.roomIndex, room.index);
    assert.ok(Number.isFinite(h.x) && Number.isFinite(h.y) && Number.isFinite(h.z));
    assert.ok(h.width > 1 && h.height > 0.7);
    const floor = h.y - h.height / 2 - room.y;
    const top = h.y + h.height / 2 - room.y;
    assert.ok(floor >= .85, `too close to floor: ${floor}`);
    assert.ok(top < ROOM_HEIGHT - .45, `too close to roof: ${top}`);
    if (h.surface.startsWith('end-')) {
      const nearestDoorEdge = Math.abs(h.x - room.x) - h.width / 2 - DOOR_WIDTH / 2;
      const nearestSideWall = room.width / 2 - Math.abs(h.x - room.x) - h.width / 2;
      assert.ok(nearestDoorEdge > .30, `end artwork blocks doorway: ${nearestDoorEdge}`);
      assert.ok(nearestSideWall > .30, `end artwork touches corner: ${nearestSideWall}`);
      assert.ok(Math.abs(h.z - room.z1) < .3);
    } else {
      assert.ok(Math.abs(Math.abs(h.x - room.x) - (room.width / 2 - .24)) < .001);
      assert.ok(h.z - h.width/2 > room.z0 + .45, 'painting collides with entrance corner');
      assert.ok(h.z + h.width/2 < room.z1 - .45, 'painting collides with exit corner');
      const group = byWall.get(h.surface) || [];
      group.push(h);
      byWall.set(h.surface,group);
    }
  }
  for (const group of byWall.values()) {
    group.sort((a,b)=>a.z-b.z);
    for(let i=1;i<group.length;i++) {
      const gap = group[i].z-group[i-1].z-(group[i].width+group[i-1].width)/2;
      assert.ok(gap >= .35, `artworks overlap on same wall: ${gap}`);
    }
  }
}

test('all studies displayed exactly once, with safe clearance in varied editions', () => {
  for (const day of ['2026-10-05','2026-10-18','2026-10-21']) {
    for (const n of [1,2,3,9,18,19,27]) {
      for (const pattern of ['mixed','portrait','landscape']) {
        const {layout,studies}=fixture(day,n,pattern);
        const hangs=planGalleryHangs(layout,studies);
        assert.deepEqual(hangs,planGalleryHangs(layout,studies),'hanging plan must reproduce');
        assert.deepEqual([...hangs.map(h=>h.studyId)].sort((a,b)=>a-b),
          studies.map(s=>s.id), 'every original appears exactly once');
        for(const room of layout.rooms) {
          verify(room,hangs.filter(h=>h.roomIndex===room.index));
        }
      }
    }
  }
});

test('hanging styles differ across galleries, and include meaningful scale variation', () => {
  const {layout,studies}=fixture('2026-10-21',18,'landscape');
  const hangs=planGalleryHangs(layout,studies);
  assert.deepEqual([...new Set(hangs.map(h=>h.profile))].sort(),
    ['asymmetric','end-wall','focal','paired','quiet','salon']);
  assert.ok(hangs.some(h=>h.surface.startsWith('end-')),'end wall must be used');
  const roles=new Set(hangs.map(h=>h.role));
  assert.ok(roles.has('hero')&&roles.has('medium')&&roles.has('small'));
  const sizes=hangs.map(h=>h.width);
  assert.ok(Math.max(...sizes)-Math.min(...sizes)>1.4,'hanging needs real size hierarchy');
  const paired=hangs.filter(h=>h.roomIndex===0);
  assert.equal(paired[0].surface,paired[1].surface,'paired works should share a wall');
});

test('poster sizes preserve original aspect ratio', () => {
  const {layout,studies}=fixture('2026-10-21',18,'mixed');
  const plans=planGalleryHangs(layout,studies);
  for(const plan of plans){
    const source=studies.find(s=>s.id===plan.studyId);
    assert.ok(Math.abs(plan.width/plan.height-source.aspect)<.00001);
  }
});
