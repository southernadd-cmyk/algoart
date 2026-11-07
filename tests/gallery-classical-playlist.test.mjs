import test from 'node:test';
import assert from 'node:assert/strict';
import {statSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {RECEPTION_RECORD_ASAP_TEST} from '../gallery/visit/gramophone-record-asap-test.mjs';
const dir=resolve(dirname(fileURLToPath(import.meta.url)),'../gallery/visit');
const additions=new Map([
 ['debussy-la-cathedrale-engloutie.ogg',5000000],
 ['debussy-clair-de-lune.ogg',14000000],
 ['ravel-pavane.ogg',5000000],
 ['satie-gymnopedie-1-macleod.mp3',6500000],
 ['bach-cello-suite-1-prelude.ogg',1700000],
 ['debussy-premiere-arabesque.ogg',14000000]
]);
test('gallery soundtrack contains original two plus six new classical recordings',()=>{
 assert.equal(RECEPTION_RECORD_ASAP_TEST.length,8);
 assert.equal(new Set(RECEPTION_RECORD_ASAP_TEST.map(t=>t.src)).size,8);
 for(const track of RECEPTION_RECORD_ASAP_TEST){
  assert.ok(track.composer && track.title && track.credit && track.source);
  assert.ok(track.src.startsWith('./audio/'));
  assert.ok(statSync(resolve(dir,track.src)).size>1000000,track.src);
 }
 for(const [name,minBytes] of additions)assert.ok(statSync(resolve(dir,'audio',name)).size>minBytes,name);
});
test('music menu and eight recording attributions are present',()=>{
 const ui=readFileSync(resolve(dir,'phi-gramophone-music.mjs'),'utf8');
 const credits=readFileSync(resolve(dir,'credits.html'),'utf8');
 assert.ok(ui.includes("track.composer.trim().split(/\\s+/).at(-1)"));
 for(const name of ['Ivan Ilić','Laurens Goedhart','Thérèse Dussaut','Kevin MacLeod','Darrell Jacobi','Patrizia Prati'])assert.ok(credits.includes(name),name);
 assert.ok(ui.includes('Music is off until you play it.'));
});
