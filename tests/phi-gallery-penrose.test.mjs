import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseGalleryPenroseRooms,pieceRoomIndex,prepareGalleryPenroseMaterial} from '../gallery/visit/phi-gallery-penrose-floor.mjs';
const txt=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const rooms=Array.from({length:8},(_,i)=>({pieces:[{x:i*6,z:0,w:6,h:8}]}));
test('live and test share a deterministic and restrained Penrose room selection',()=>{
 const selected=chooseGalleryPenroseRooms(rooms,'2026-10-15');
 assert.equal(selected.length,2);
 assert.deepEqual(selected,chooseGalleryPenroseRooms(rooms,'2026-10-15'));
 assert.deepEqual(chooseGalleryPenroseRooms([{pieces:[{x:0,z:0,w:2,h:3}]}],'2026-10-15'),[]);
 assert.equal(pieceRoomIndex({x:12,z:0,w:6,h:8},rooms),2);
 assert.equal(pieceRoomIndex({x:-30,z:0,w:6,h:8},rooms),-1);
 const builder=txt('../automation/build-phi-test-room-signs.mjs');
 const live=txt('../gallery/visit/gallery-phi.js');
 const liveHtml=txt('../gallery/visit/index.html');
 const testHtml=txt('../test/virtual-gallery/full-engine.html');
 assert.ok(!builder.includes('replace(" for(const p of phi.pieces)'));
 assert.ok(live.includes("import {chooseGalleryPenroseRooms,prepareGalleryPenroseMaterial,pieceRoomIndex}"));
 assert.ok(live.includes('const galleryPenroseRooms=exhibitDate===RECEPTION?[]:chooseGalleryPenroseRooms'));
 assert.ok(live.includes('galleryPenroseRooms.includes(pieceRoomIndex(p,phi.floor.mergedRooms))'));
 assert.ok(live.includes('if(finish===receptionTilePreview||selected)alignReceptionTileUvs(slab)'));
 assert.ok(liveHtml.includes('gallery-phi-bundle.js?v=penrose-gallery-live-20261030'));
 assert.ok(testHtml.includes('gallery-phi-test-room-signs-bundle.js'));
 assert.ok(builder.includes('stagingFloorUrl'));
});
test('subtle finish keeps original PBR maps and a single shared material',()=>{
 class Vector2{constructor(x,y){this.x=x;this.y=y;}set(x,y){this.x=x;this.y=y;}}
 class TextureLoader{load(){return {userData:{}};}}
 const THREE={Vector2,TextureLoader,SRGBColorSpace:'srgb',ClampToEdgeWrapping:1};
 const source={map:{id:1},userData:{tileMeters:2.25},clone(){return {...this,userData:{...this.userData}};}};
 const first=prepareGalleryPenroseMaterial(THREE,source,[{x:0,z:0,w:20,h:10}]);
 assert.notEqual(first,source);assert.equal(first.map,source.map);
 const shader={uniforms:{},fragmentShader:'void main() {\n#include <map_fragment>\n}'};
 first.onBeforeCompile(shader);
 assert.ok(shader.fragmentShader.includes('texture2D(penroseMap,inlayUV)'));
 assert.equal(shader.uniforms.penroseStrength.value,.29);
 source.map={id:2};
 const second=prepareGalleryPenroseMaterial(THREE,source,[{x:8,z:0,w:30,h:12}]);
 assert.equal(second,first);assert.equal(second.map,source.map);
 assert.equal(shader.uniforms.penroseSpan.value,32);
});
