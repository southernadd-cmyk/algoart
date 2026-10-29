import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roomSignTitle,planHangingRoomSigns} from '../gallery/visit/phi-room-hanging-signs.mjs';

const fixture=()=>({
 floor:{mergedRooms:[
  {pieces:[{x:0,z:0,w:6,h:8}]},
  {pieces:[{x:6,z:0,w:6,h:8}]}
 ]},
 circulation:{
  lift:{room:0,portal:{axis:'x',at:0,centre:3,width:2.4}},
  doors:[{axis:'x',at:6,centre:4,width:2.4,a:0,b:1}]
 },
 exhibition:{curation:{rooms:[
  {room:0,studyIds:[1,2,3,4],theme:{dimension:'palette',value:'marker',count:4,studyIds:[1,2,3,4]}},
  {room:1,studyIds:[5,6,7,8],theme:{dimension:'material',value:'oil',count:4,studyIds:[5,6,7,8]}}
 ]}}
});
test('formal room naming distinguishes palette, material and engine',()=>{
 assert.equal(roomSignTitle({room:0,studyIds:[1,2,3],theme:{dimension:'palette',value:'marker',count:3}}),'Room 1 · Marker palette');
 assert.equal(roomSignTitle({room:1,studyIds:[1,2,3],theme:{dimension:'material',value:'oil',count:3}}),'Room 2 · Oil');
 assert.equal(roomSignTitle({room:2,studyIds:[1,2,3],theme:{dimension:'engine',value:'rects',count:3}}),'Room 3 · Rectangular forms');
});
test('no theme or minority-only themes do not produce misleading signs',()=>{
 assert.equal(roomSignTitle({room:0,studyIds:[1,2,3,4,5],theme:{dimension:'material',value:'oil',count:2}}),'');
 assert.equal(roomSignTitle({room:0,studyIds:[1,2,3],theme:null}),'');
});
test('one sign per curated room just inside the appropriate entry portal',()=>{
 const signs=planHangingRoomSigns(fixture());
 assert.equal(signs.length,2);
 assert.deepEqual(signs.map(s=>s.label),['Room 1 · A Marker Palette','Room 2 · Colour with Weight']);
 assert.ok(signs[0].x>0&&signs[0].x<6);
 assert.ok(signs[1].x>6&&signs[1].x<12);
 assert.equal(signs[0].yaw,Math.PI/2);
 assert.equal(signs[1].yaw,Math.PI/2);
});
test('staging bundle isolation and marker font double-sided geometry',()=>{
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const module=readFileSync(new URL('../gallery/visit/phi-room-hanging-signs.mjs',import.meta.url),'utf8');
 const live=readFileSync(new URL('../gallery/visit/index.html',import.meta.url),'utf8');
 const staging=readFileSync(new URL('../test/virtual-gallery/full-engine.html',import.meta.url),'utf8');
 assert.match(builder,/gallery-phi-test-room-signs-bundle\.js/);
 assert.match(staging,/gallery-phi-test-room-signs-bundle\.js/);
 assert.match(live,/import\('\.\/gallery-phi-bundle\.js\?/);
 assert.doesNotMatch(live,/test-room-signs/);
 assert.match(live,/curated-hanging-room-signs/);
 assert.match(live,/Sousinho/);
 const gallerySource=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.match(gallerySource,/import \{addHangingRoomSigns\} from '.\/phi-room-hanging-signs\.mjs'/);
 assert.match(gallerySource,/window\.__phiRoomSigns=exhibitDate===RECEPTION\?\[\]/);
 assert.match(gallerySource,/addHangingRoomSigns\(THREE,scene,phi,elevation,ROOM_HEIGHT\)/);
 assert.match(module,/AlgoArt Marker/);
 assert.match(module,/for\(const side of \[-1,1\]\)/);
 assert.match(module,/Sousinho/);
});

test('mixed rooms use complete contents, including a minority material',()=>{
 const room={room:0,studyIds:[0,1,2,3],theme:{dimension:'material',value:'watercolour',count:3},
  composition:{material:[{value:'watercolour',count:3},{value:'oil',count:1}],engine:[],palette:[]}};
 assert.equal(roomSignTitle(room),'Room 1 · Watercolour / Oil');
 room.composition.engine=[{value:'growth',count:4}];
 assert.equal(roomSignTitle(room),'Room 1 · Growth systems');
 room.composition.engine=[];
 room.composition.material=[{value:'watercolour',count:2},{value:'oil',count:1},{value:'marker',count:1}];
 assert.equal(roomSignTitle(room),'Room 1 · Mixed materials');
 room.composition.material=[{value:'watercolour',count:3},{value:'',count:1}];
 assert.equal(roomSignTitle(room),'Room 1 · Mixed studies');
 assert.equal(roomSignTitle({...room,composition:undefined}),'');
});
