import test from 'node:test';
import assert from 'node:assert/strict';
import {movementPlan,velocityWidths,ribbonOutline} from '../test/graffiti/skuf-movement-v2.mjs';
test('same seed reproduces movement plan and different seeds change gesture variation',()=>{
 assert.deepEqual(movementPlan('a'),movementPlan('a'));
 assert.notDeepEqual(movementPlan('a'),movementPlan('b'));
 assert.equal(movementPlan('a').length,9);
});
test('velocity and curvature produce valid variable-width ribbon',()=>{
 const p=velocityWidths([{x:0,y:0},{x:10,y:0},{x:14,y:5},{x:14,y:15}],{base:9});
 assert.ok(p.every(q=>Number.isFinite(q.width)&&q.width>0));
 assert.ok(new Set(p.map(q=>q.width.toFixed(4))).size>1);
 assert.match(ribbonOutline(p),/^M.*Z$/);
});
