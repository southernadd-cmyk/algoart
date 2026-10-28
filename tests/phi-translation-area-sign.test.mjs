import test from 'node:test';
import assert from 'node:assert/strict';
import {TRANSLATION_SIGN_TEXT,translationAreaSignPlacement} from '../gallery/visit/phi-translation-area-sign.mjs';

test('Gallery label is a curatorial introduction, not a technical instruction panel',()=>{
 assert.equal(TRANSLATION_SIGN_TEXT.title,'THE TRANSLATION AREA');
 assert.match(TRANSLATION_SIGN_TEXT.subtitle,/transformation/);
 assert.ok(TRANSLATION_SIGN_TEXT.lines.some(line=>/marks becoming motion/.test(line)));
});
test('Place model outside the doorway rather than across the accessible opening',()=>{
 const room={x:4,z:6,width:5,depth:5};
 const doors=[{axis:'z',at:3.5,centre:4,width:2.6,public:false}];
 const s=translationAreaSignPlacement(room,doors,{x:4,z:-2});
 assert.ok(s);
 assert.equal(s.axis,'z');
 assert.equal(s.doorCentre,4);
 assert.ok(Math.abs(s.x-s.doorCentre)>s.doorWidth/2+.45);
 assert.ok(s.z<s.doorAt,'Model should be on foyer side of the door');
 assert.ok(Math.abs(s.yaw-Math.PI)<.01||Math.abs(s.yaw+Math.PI)<.01,'Board faces foyer');
});
test('Never place the board when there is no matching physical doorway',()=>{
 const room={x:4,z:6,width:5,depth:5};
 assert.equal(translationAreaSignPlacement(room,[{axis:'x',at:14,centre:20,width:2.6}],{x:4,z:-2}),null);
});
