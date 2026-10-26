import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalStroke,planLoopsOrbit,movementPoint,STROKE_PLAN_REVISION} from './stroke-plan.mjs';
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

test('golden trajectories break at spaces and vary by seed and mode',()=>{
 const plan={seed:'study',letters:[{index:0,x:0},{index:1,x:80},{index:3,x:250},{index:4,x:330}]};
 const a=planLoopsOrbit(plan,{mode:'restrained',seed:'one'});
 assert.equal(a.length,2);
 assert.deepEqual(a.map(x=>x.wordIndex),[0,1]);
 assert.ok(a.every(x=>x.generator==='golden-trajectory-v1'));
 assert.deepEqual(a,planLoopsOrbit(plan,{mode:'restrained',seed:'one'}));
 assert.notDeepEqual(a,planLoopsOrbit(plan,{mode:'expressive',seed:'one'}));
 assert.notDeepEqual(a,planLoopsOrbit(plan,{mode:'restrained',seed:'two'}));
 assert.deepEqual(planLoopsOrbit(plan,{mode:'none'}),[]);
});

test('golden movement is deterministic, bounded, and family-specific',()=>{
 for(const family of 'ABCDEFGHI'){
  const args={family,letterIndex:2,strokeIndex:1,seed:'stable',mode:'restrained'};
  const p=movementPoint(24,49,args);
  assert.deepEqual(p,movementPoint(24,49,args));
  assert.ok(Math.abs(p.x-24)<5&&Math.abs(p.y-49)<6,family+' distorts legibility');
  assert.deepEqual(movementPoint(24,49,{...args,mode:'none'}),{x:24,y:49});
 }
 assert.notDeepEqual(movementPoint(24,49,{family:'G',seed:'one'}),movementPoint(24,49,{family:'D',seed:'one'}));
});
