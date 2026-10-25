import test from 'node:test';
import assert from 'node:assert/strict';
import {LETTERS,ALPHABET_ID,ALPHABET_REVISION,HANDSTYLE_GLYPHS,glyphFor,planLetters} from '../test/graffiti/skuf-complete-alphabet.mjs';
function checkPath(d){
 const tokens=d.match(/[MCQLZ]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g)||[];
 assert.equal(tokens[0],'M');let i=0,segments=0;
 while(i<tokens.length){
  const command=tokens[i++],arity={M:2,C:6,Q:4,L:2,Z:0}[command];
  assert.notEqual(arity,undefined,'Unsupported SVG path command '+command);
  for(let j=0;j<arity;j++){assert.ok(i<tokens.length,'Missing path argument');assert.ok(Number.isFinite(Number(tokens[i++])),'Invalid path coordinate')}
  segments++;
 }
 assert.ok(segments>=2);
}
test('all 26 individually authored uppercase letters are present',()=>{
 assert.equal(LETTERS,'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
 assert.equal(Object.keys(HANDSTYLE_GLYPHS).length,26);
 assert.equal(new Set(LETTERS.split('').map(ch=>HANDSTYLE_GLYPHS[ch].strokes.join('|'))).size,26);
 assert.equal(ALPHABET_ID,'skuf-exploration');
 assert.match(ALPHABET_REVISION,/^draft/);
});
test('every letter contains multiple well formed gesture paths',()=>{
 for(const ch of LETTERS){
  const glyph=glyphFor(ch);
  assert.ok(glyph.width>30&&glyph.width<140,ch);
  assert.ok(glyph.strokes.length>=2,ch);
  for(const path of glyph.strokes)checkPath(path);
 }
});
test('unfamiliar words are laid out using authored gestures without hidden fallback',()=>{
 for(const word of ['SKUF','PROPORTION PIECE','PHI','MUSHROOM','ABCDEFGHIJKLMNOPQRSTUVWXYZ']){
  const plan=planLetters(word);
  assert.deepEqual(plan.items.map(i=>i.ch).join(''),word.replace(/[^A-Z]/g,''));
  assert.ok(plan.width>0);
  assert.ok(plan.items.every(i=>i.strokes===glyphFor(i.ch).strokes));
 }
 assert.throws(()=>glyphFor('1'),RangeError);
});
test('fixed seeds are bit-for-bit reproducible and different seeds alter placement',()=>{
 const one=planLetters('PROPORTION PIECE',{seed:'a'});
 assert.deepEqual(one,planLetters('PROPORTION PIECE',{seed:'a'}));
 assert.notDeepEqual(one,planLetters('PROPORTION PIECE',{seed:'b'}));
});
test('invalid inputs and unconstrained distortion are rejected',()=>{
 assert.throws(()=>planLetters('@@@'),RangeError);
 assert.throws(()=>planLetters('PHI',{tightness:.3}),RangeError);
 assert.throws(()=>planLetters('PHI',{variation:1}),RangeError);
});
test('the SKUF pair uses deliberate compact layout',()=>{
 const skuf=planLetters('SKUF',{seed:'fixed',variation:0});
 const positions=skuf.items.map(i=>i.x);
 assert.ok(positions.every((x,i)=>i===0||x>positions[i-1]));
 assert.ok(positions[1]<glyphFor('S').width*.88);
});
