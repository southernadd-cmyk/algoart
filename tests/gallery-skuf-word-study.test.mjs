import test from 'node:test';
import assert from 'node:assert/strict';
import {planSkufName,skufNameSvg} from '../test/graffiti/skuf-word-study.mjs';
test('SKUF study is word-specific and not a generic substitute alphabet',()=>{
 assert.throws(()=>planSkufName('PHI'),RangeError);
 const p=planSkufName();assert.deepEqual(p.characters.map(c=>c.ch),['S','K','U','F']);
 assert.ok(p.characters.every(c=>c.paths.length>=2));
 assert.ok(p.offsets[1]<p.characters[0].advance);
 assert.match(skufNameSvg(),/viewBox/);
});
