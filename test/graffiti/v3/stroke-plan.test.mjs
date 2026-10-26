import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalStroke,planLoopsOrbit,STROKE_PLAN_REVISION} from './stroke-plan.mjs';
test('primary, secondary, ornaments remain distinct',()=>{
 const primary=physicalStroke({kind:'stroke',width:10},'D');
 const thin=physicalStroke({kind:'hairline',width:10},'D');
 assert.equal(primary.role,'primary');
 assert.equal(thin.role,'secondary');
 assert.ok(primary.width>thin.width);
 assert.equal(physicalStroke({kind:'stroke',role:'ornament',width:10},'D').role,'ornament');
 assert.match(STROKE_PLAN_REVISION,/stroke-plan/);
});
test('Loops gesture deterministic and separate from letter structures',()=>{
 const plan={letters:[{x:0},{x:92},{x:204}],height:156};
 const gestures=planLoopsOrbit(plan);
 assert.equal(gestures.length,1);
 assert.equal(gestures[0].wordGesture,true);
 assert.match(gestures[0].d,/^M /);
 assert.deepEqual(gestures,planLoopsOrbit(plan));
 assert.deepEqual(planLoopsOrbit({letters:[{x:0}]}),[]);
});
