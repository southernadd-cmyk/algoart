import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLayout} from '../gallery/visit/layout-v2.mjs';
const read=p=>readFileSync(p,'utf8');

test('tower illustration projects real lower floor plans, rooms and bridges',()=>{
  const {floors}=JSON.parse(read('gallery/tower-layouts.json'));
  const svg=read('gallery/visit/tower-still.svg');
  const rows=[...svg.matchAll(/<g data-floor="([^"]+)" data-room-count="(\d+)" data-bridge-count="(\d+)">/g)];
  assert.equal(rows.length,Math.min(15,floors.length));
  assert.match(svg,/viewBox="0 0 1200 480"/);
  assert.match(svg,/more floors|continue above|continue beyond|continue above the frame|continue above the image|extend/i);
  assert.doesNotMatch(svg,/class="window"|decorative window grid/i);
  for(let i=0;i<rows.length;i++){
    const f=floors[i],studyStates=f.studies.map(([seed,engine])=>({seed,engine}));
    const plan=buildLayout(f.date,studyStates.length,studyStates);
    assert.equal(rows[i][1],f.date);
    assert.equal(Number(rows[i][2]),plan.rooms.length,'Wrong rooms on '+f.date);
    assert.equal(Number(rows[i][3]),plan.corridors.length,'Wrong glass corridors on '+f.date);
  }
  assert.ok((svg.match(/<polygon /g)||[]).length>rows.length*2,
    'Real architectural massing must be drawn as faces, not repeated storey stripes');
});
