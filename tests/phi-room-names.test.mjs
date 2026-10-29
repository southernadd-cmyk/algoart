import test from 'node:test';
import assert from 'node:assert/strict';
import {nameExhibitionRooms} from '../gallery/visit/phi-room-names.mjs';
const room=(n,material,engine=[])=>({room:n,studyIds:[0,1,2,3],composition:{material,engine,palette:[]}});
const pair=[{value:'watercolour',count:3},{value:'oil',count:1}];
test('a minority oil work produces a two-material title',()=>{
 assert.deepEqual(nameExhibitionRooms([room(0,pair)]).get(0),{title:'Wash and Weight',dimension:'material',values:['oil','watercolour']});
});
test('a shared engine can name works in different materials',()=>{
 assert.equal(nameExhibitionRooms([room(0,pair,[{value:'growth',count:4}])]).get(0).title,'Branching Orders');
 assert.equal(nameExhibitionRooms([room(0,pair,[{value:'growth',count:3},{value:'field',count:1}])]).get(0).title,'Wash and Weight');
});
test('room titles are distinct, deterministic and independent of array order',()=>{
 const rooms=Array.from({length:20},(_,i)=>room(i,pair));
 const names=nameExhibitionRooms(rooms);
 assert.equal(new Set([...names.values()].map(n=>n.title)).size,20);
 assert.deepEqual(nameExhibitionRooms([...rooms].reverse()),names);
 assert.deepEqual(nameExhibitionRooms(structuredClone(rooms)),names);
});
test('unknown traits never earn a material title',()=>{
 const names=nameExhibitionRooms([room(0,[{value:'watercolour',count:3},{value:'',count:1}])]);
 assert.equal(names.get(0).dimension,null);
});
