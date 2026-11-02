import assert from 'node:assert/strict';
import test from 'node:test';
import {PHI_ROOM_POOL_SIZE,PHI_ART_POOL_SIZE,chooseNearestPhiRoomAnchors} from '../test/virtual-gallery/phi-bounded-light-pool.mjs';

const anchor=(x,z,id)=>({position:{x,z},roomIndex:id,power:14});
test('bounded option uses exactly six real spotlights across three room and three art slots',()=>{
 assert.equal(PHI_ROOM_POOL_SIZE,3);assert.equal(PHI_ART_POOL_SIZE,3);
});
test('nearest room candidates change without allocating more spotlights',()=>{
 const rooms=[anchor(0,0,0),anchor(4,0,1),anchor(8,0,2),anchor(12,0,3),anchor(16,0,4)];
 assert.deepEqual(chooseNearestPhiRoomAnchors(rooms,{x:1,z:0}).map(x=>x.roomIndex),[0,1,2]);
 assert.deepEqual(chooseNearestPhiRoomAnchors(rooms,{x:15,z:0}).map(x=>x.roomIndex),[4,3,2]);
 assert.equal(chooseNearestPhiRoomAnchors(rooms,{x:15,z:0}).length,3);
});
test('ties preserve deterministic original room ordering',()=>{
 const rooms=[anchor(-2,0,0),anchor(2,0,1),anchor(0,4,2)];
 assert.deepEqual(chooseNearestPhiRoomAnchors(rooms,{x:0,z:0},2).map(x=>x.roomIndex),[0,1]);
});
test('empty reception and fewer rooms retain valid pooled light selection',()=>{
 assert.deepEqual(chooseNearestPhiRoomAnchors([],{x:0,z:0}),[]);
 const room=anchor(1,2,3);assert.deepEqual(chooseNearestPhiRoomAnchors([room],{x:0,z:0}),[room]);
});
test('selection does not move phi anchors or change their intensity',()=>{
 const rooms=[anchor(0,0,0),anchor(1,0,1),anchor(2,0,2),anchor(3,0,3)];
 const original=JSON.stringify(rooms);
 chooseNearestPhiRoomAnchors(rooms,{x:2,z:0},3);
 assert.equal(JSON.stringify(rooms),original);
});
test('invalid pool sizes are rejected',()=>{
 assert.throws(()=>chooseNearestPhiRoomAnchors([],{x:0,z:0},-1),RangeError);
});
