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
test('two directional faces name the room beyond each doorway',()=>{
 const signs=planHangingRoomSigns(fixture());
 assert.equal(signs.length,2,'one inner doorway and one lift entrance');
 const inner=signs.find(s=>s.kind==='room');
 const lift=signs.find(s=>s.kind==='lift');
 assert.equal(inner.x,6);assert.equal(inner.z,4);
 assert.equal(inner.yaw,Math.PI/2);
 // +x side is room 2: walking -x means entering room 1.
 assert.equal(inner.plusRoom,1);assert.equal(inner.minusRoom,0);
 assert.equal(inner.faces.positive.label,'Room 1 · A Marker Palette');
 assert.equal(inner.faces.negative.label,'Room 2 · Colour with Weight');
 assert.equal(lift.faces.positive.label,'Archive lift');
 assert.equal(lift.faces.negative.label,'Room 1 · A Marker Palette');
});
test('z-axis and reversed a/b identifiers still name the destination',()=>{
 const phi={
  floor:{mergedRooms:[
   {pieces:[{x:0,z:0,w:8,h:6}]},{pieces:[{x:0,z:6,w:8,h:6}]}
  ]},
  circulation:{doors:[{axis:'z',at:6,centre:4,width:2.4,a:1,b:0}]},
  exhibition:{curation:{rooms:[
   {room:0,studyIds:[1,2],composition:{engine:[{value:'growth',count:2}],material:[],palette:[]}},
   {room:1,studyIds:[3,4],composition:{engine:[{value:'field',count:2}],material:[],palette:[]}}
  ]}}
 };
 const signs=planHangingRoomSigns(phi);
 assert.equal(signs.length,1);
 const doorway=signs[0];assert.equal(doorway.yaw,0);
 assert.equal(doorway.plusRoom,1);assert.equal(doorway.minusRoom,0);
 assert.equal(doorway.faces.positive.label,'Room 1 · Branching Orders');
 assert.equal(doorway.faces.negative.label,'Room 2 · Around a Centre');
});
test('glass walkways get a named gallery-facing side without duplicate signs',()=>{
 const phi=fixture();
 const bridge={axis:'x',at:12,centre:4,width:2.4};
 phi.circulation.bridgePortals=[bridge,{...bridge}];
 const signs=planHangingRoomSigns(phi);
 assert.equal(signs.length,3);
 const pass=signs.find(s=>s.kind==='bridge');
 assert.equal(pass.faces.positive.label,'Room 2 · Colour with Weight');
 assert.equal(pass.faces.negative.label,'Glass walkway');
});
test('staging page isolation and marker font double-sided geometry',()=>{
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const module=readFileSync(new URL('../gallery/visit/phi-room-hanging-signs.mjs',import.meta.url),'utf8');
 const live=readFileSync(new URL('../gallery/visit/index.html',import.meta.url),'utf8');
 const staging=readFileSync(new URL('../test/virtual-gallery/full-engine.html',import.meta.url),'utf8');
 assert.match(builder,/gallery-phi-test-room-signs-bundle\.js/);
 assert.match(staging,/test\/virtual-gallery\/gallery-phi-bundle\.js/);
 assert.match(live,/import\('\.\/gallery-phi-bundle\.js\?/);
 assert.doesNotMatch(live,/test-room-signs/);
 assert.match(live,/gallery-phi-bundle\.js\?v=/);
 assert.match(live,/Sousinho/);
 const gallerySource=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.match(gallerySource,/import \{addHangingRoomSigns\} from '.\/phi-room-hanging-signs\.mjs'/);
 assert.match(gallerySource,/window\.__phiRoomSigns=exhibitDate===RECEPTION\?\[\]/);
 assert.match(gallerySource,/addHangingRoomSigns\(THREE,scene,phi,elevation,ROOM_HEIGHT\)/);
 assert.match(module,/AlgoArt Marker/);
 assert.ok(module.includes('for(const side of [-1,1])'));
 assert.ok(module.includes('spec.faces.positive'));
 assert.ok(module.includes('spec.faces.negative'));
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
