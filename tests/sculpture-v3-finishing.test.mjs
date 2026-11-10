import test from 'node:test';
import assert from 'node:assert/strict';
import {smoothClosedContour,interpolatePath,selectBalancedMarks}
  from '../gallery/sculpture-lab/sculpture-v3-finishing.mjs';
test('staircase painterly edges close cleanly, remain source-anchored and uniformly sampled',()=>{
  const rect=[];
  for(let x=0;x<40;x++)rect.push([x,0]);
  for(let y=0;y<24;y++)rect.push([40,y]);
  for(let x=40;x>0;x--)rect.push([x,24]);
  for(let y=24;y>0;y--)rect.push([0,y]);
  const s=smoothClosedContour(rect,{passes:3,spacing:2.4,maxPoints:90});
  assert.ok(s.length>16&&s.length<=91);
  assert.deepEqual(s[0],s.at(-1));
  assert.ok(s.every(([x,y])=>x>=-.01&&x<=40.01&&y>=-.01&&y<=24.01));
  const distances=s.slice(1).map((p,i)=>Math.hypot(p[0]-s[i][0],p[1]-s[i][1]));
  assert.ok(Math.max(...distances)<3.5);
  assert.ok(Math.min(...distances)>0);
});
test('spatial anchors are lerped continuously, not rounded to coarse row vertices',()=>{
  const p=[{x:-.3,y:-.6},{x:0,y:0},{x:.3,y:.6}];
  assert.deepEqual(interpolatePath(p,0),p[0]);
  assert.deepEqual(interpolatePath(p,1),p[2]);
  assert.ok(Math.abs(interpolatePath(p,.25).x+.15)<1e-7);
});
test('mark selection caps clutter without altering genuine front positions',()=>{
  const marks=Array.from({length:90},(_,i)=>({
    score:90-i,sourceId:i,points:[{x:-.6+i*.01,y:-.8},{x:-.5+i*.01,y:.8}]
  }));
  const b=selectBalancedMarks(marks,20);
  assert.equal(b.length,20);
  assert.equal(new Set(b.map(s=>s.sourceId)).size,20);
  assert.ok(b.every(m=>marks.includes(m)));
});