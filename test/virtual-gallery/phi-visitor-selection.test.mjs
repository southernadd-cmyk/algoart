import test from 'node:test';
import assert from 'node:assert/strict';
import {nearestVisitorOnFloor} from './phi-visitor-selection.mjs';

const person=(index,x,z,y=0)=>({index,x,y,z,room:0});

test('toolbar selects the closest real visitor, regardless of the T-prompt radius',()=>{
 const people=[person(0,30,0),person(1,10,0),person(2,3,0)];
 assert.equal(nearestVisitorOnFloor(people,{x:0,y:1.6,z:0})?.index,2);
 assert.equal(nearestVisitorOnFloor(people,{x:29,y:1.6,z:0})?.index,0);
 assert.equal(nearestVisitorOnFloor(people,{x:11,y:1.6,z:0})?.index,1);
});

test('selection responds to movement without a cached visitor',()=>{
 const people=[person(100,-5,1),person(200,7,1)];
 assert.equal(nearestVisitorOnFloor(people,{x:-4,y:1.5,z:1})?.index,100);
 assert.equal(nearestVisitorOnFloor(people,{x:8,y:1.5,z:1})?.index,200);
});

test('visitors on another floor are excluded even when horizontally closest',()=>{
 const people=[person(3,0,0,6.2),person(5,7,0,0)];
 assert.equal(nearestVisitorOnFloor(people,{x:0,y:1.6,z:0})?.index,5);
 assert.equal(nearestVisitorOnFloor(people,{x:0,y:7.8,z:0})?.index,3);
});

test('late-loaded outside visitors and an empty list are handled',()=>{
 const people=[person(100,4,0),person(200,1,0)];
 assert.equal(nearestVisitorOnFloor(people,{x:0,y:1.5,z:0})?.index,200);
 assert.equal(nearestVisitorOnFloor([], {x:0,y:1.5,z:0}),null);
 assert.equal(nearestVisitorOnFloor([person(4,0,0,12.4)],{x:0,y:1.5,z:0}),null);
 assert.equal(nearestVisitorOnFloor([person(4,0,0,NaN),person(5,2,0)],{x:0,y:1.5,z:0})?.index,5);
});
