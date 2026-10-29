import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceLiftDoor} from '../gallery/visit/phi-lift-motion.mjs';
test('opening has the same position at 30, 60 and 120 Hz',()=>{
 const positions=[30,60,120].map(hz=>{let c=1;for(let i=0;i<hz;i++)c=advanceLiftDoor(c,0,1/hz);return c;});
 for(const c of positions)assert.ok(Math.abs(c-positions[0])<1e-12);
});
test('a multi-second GPU stall cannot snap an opening or closing door',()=>{
 assert.ok(advanceLiftDoor(1,0,3)>.8);
 assert.ok(advanceLiftDoor(0,1,3)<.2);
});
test('opening and closing converge monotonically to their exact endpoints',()=>{
 for(const target of [0,1]){let c=1-target;
 for(let i=0;i<180;i++){const next=advanceLiftDoor(c,target,1/60);assert.ok(target?next>=c:next<=c);assert.ok(next>=0&&next<=1);c=next;}
 assert.equal(c,target);}
});
