import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLayout, footprintAt, canStand, PHI} from './layout.mjs';

test('same edition, same architecture every time', () => {
  const a = buildLayout('2026-10-21', 18);
  const b = buildLayout('2026-10-21', 18);
  assert.deepEqual(a, b);
  assert.equal(a.rooms.length, 6);
  assert.equal(a.rooms.reduce((n,r) => n+r.artEnd-r.artStart,0),18);
  assert.ok(Math.abs(PHI-1.618033988749895)<1e-12);
});

test('each public edition maps to a valid walkable exhibition', () => {
  for (const date of ['2026-10-05','2026-10-18','2026-10-21']) {
    for (const count of [1,9,18,19]) {
      const gallery = buildLayout(date,count);
      assert.equal(gallery.rooms.length,Math.ceil(count/3));
      for (const room of gallery.rooms) {
        assert.ok(room.width>gallery.doorWidth);
        assert.ok(room.depth>10);
        assert.ok(canStand(gallery,room.x,(room.z0+room.z1)/2));
      }
      const last=gallery.rooms.at(-1);
      // The central promenade stays inside the walkable footprint.
      for(let z=0;z<last.z1;z+=.1) {
        const f=footprintAt(gallery,z);
        assert.ok(f, 'missing floor at '+z);
        assert.ok(canStand(gallery,f.x,z), 'blocked path at '+z);
      }
      for(let i=0;i<gallery.rooms.length-1;i++) {
        const a=gallery.rooms[i], b=gallery.rooms[i+1];
        const slope=Math.abs(b.y-a.y)/(b.z0-a.z1);
        assert.ok(slope<.09,'steep walkway at '+i+': '+slope);
      }
    }
  }
});
