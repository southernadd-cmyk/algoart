import test from 'node:test';
import assert from 'node:assert/strict';
import {TRANSLATION_SIGN_TEXT,TRANSLATION_SIGN_SCALE,translationAreaSignPlacement} from '../gallery/visit/phi-translation-area-sign.mjs';

test('Curatorial label keeps its exhibition identity',()=>{
 assert.equal(TRANSLATION_SIGN_TEXT.title,'THE TRANSLATION AREA');
 assert.match(TRANSLATION_SIGN_TEXT.subtitle,/transformation/);
 assert.ok(TRANSLATION_SIGN_TEXT.lines.some(line=>/marks becoming motion/.test(line)));
});
test('The enlarged original chalkboard is 1.6 metres tall',()=>{
 assert.equal(TRANSLATION_SIGN_SCALE,1.65);
 assert.ok(.995*TRANSLATION_SIGN_SCALE>1.6);
});
test('Sign sits on the gramophone side of the public GLASS door but not in the doorway',()=>{
 const door={axis:'z',at:0,centre:2,width:2.6};
 const gramophone={x:6.5,z:3};
 const p=translationAreaSignPlacement(door,gramophone);
 assert.ok(p);
 assert.equal(p.zone,'reception-main-door-gramophone');
 assert.ok(p.x>door.centre+door.width/2+.42*TRANSLATION_SIGN_SCALE/2+.25);
 assert.ok(p.x<gramophone.x,'Sign must be BETWEEN the door and gramophone');
 assert.ok(p.z>door.at && p.z<gramophone.z);
 assert.ok(p.lateralClearance>=.29,'Keep the door's walkable opening clear even with larger sign');
 assert.ok(p.distanceToGramophone>=1.1,'Keep clear of the gramophone cabinet');
 assert.equal(p.yaw,0,'Sign faces visitors inside reception');
});
test('Equivalent safe placement for rotated X-axis entrance',()=>{
 const door={axis:'x',at:0,centre:2,width:2.4};
 const g={x:3,z:6.5};
 const p=translationAreaSignPlacement(door,g);
 assert.ok(p);
 assert.equal(p.zone,'reception-main-door-gramophone');
 assert.ok(p.z>2+1.2);
 assert.ok(p.z<g.z);
 assert.ok(p.distanceToGramophone>=1.1);
 assert.ok(Math.abs(p.yaw-Math.PI/2)<.001);
});
test('Do not guess placement without the real door and the gramophone',()=>{
 assert.equal(translationAreaSignPlacement(null,{x:4,z:3}),null);
 assert.equal(translationAreaSignPlacement({axis:'z',at:0,centre:4,width:3},null),null);
});
