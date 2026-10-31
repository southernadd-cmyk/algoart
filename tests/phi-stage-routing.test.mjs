import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stagingFloorUrl} from '../test/virtual-gallery/phi-stage-routing.mjs';

const base='https://southernadd-cmyk.github.io/algoart/test/virtual-gallery/full-engine.html';
test('lift journeys stay under test tower even with the live gallery asset base',()=>{
 const start=base+'?signs=v1&debug&date=2026-10-27#world';
 const next=stagingFloorUrl(start,'2026-10-28');
 assert.equal(next,'/algoart/test/virtual-gallery/full-engine.html?signs=v1&debug=&date=2026-10-28#world');
 assert.equal(new URL(next,'https://southernadd-cmyk.github.io/gallery/visit/').pathname,
  '/algoart/test/virtual-gallery/full-engine.html');
 assert.equal(stagingFloorUrl(base+'?debug&date=2026-10-27','__phi_reception__'),
  '/algoart/test/virtual-gallery/full-engine.html?debug=');
});
test('direct dated floor links and short test-tower entry both retain identity',()=>{
 for(const name of ['full-engine.html','index.html']){
  const at='https://southernadd-cmyk.github.io/algoart/test/virtual-gallery/'+name+'?date=2026-10-26';
  const next=stagingFloorUrl(at,'2026-10-29');
  assert.equal(next,'/algoart/test/virtual-gallery/'+name+'?date=2026-10-29');
 }
});
test('both staging HTML entries import a test-local copy of the live bundle',()=>{
 const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
 for(const path of ['../test/virtual-gallery/index.html','../test/virtual-gallery/full-engine.html']){
  const html=read(path);
  assert.match(html,/import\('\.\.\/\.\.\/test\/virtual-gallery\/gallery-phi-bundle\.js\?v=/);
  assert.doesNotMatch(html,/await import\('\.\/gallery-phi-bundle\.js/);
  assert.match(html,/<base href="\.\.\/\.\.\/gallery\/visit\/">/);
 }
 const builder=read('../automation/build-phi-test-room-signs.mjs');
 assert.match(builder,/stagingFloorUrl\(location\.href,date,RECEPTION\)/);
 assert.match(builder,/history\.replaceState/);
 assert.doesNotMatch(builder,/addHangingRoomSigns/);
 const production=read('../gallery/visit/gallery-phi.js');
 assert.doesNotMatch(production,/stagingFloorUrl/);
 assert.match(production,/addHangingRoomSigns/);
});
