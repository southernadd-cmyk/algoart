import test from 'node:test';
import assert from 'node:assert/strict';
import {FAMILIES as v1,composeWord as composeV1} from '../family-library.mjs';
import {FAMILIES as v2,composeWord as composeV2,getGlyph,pilotDiff,PILOT_EVIDENCE,V2_REVISION} from './v2-library.mjs';

test('Source-led pilot edits exactly ten independently authored glyphs',()=>{
 assert.deepEqual(pilotDiff().sort(),['D:E','D:H','D:S','E:A','E:H','E:M','E:N','F:A','F:S','I:M']);
 assert.deepEqual(Object.keys(PILOT_EVIDENCE).sort(),pilotDiff().sort());
 assert.equal(v1.length,9);assert.equal(v2.length,9);
 for(let i=0;i<9;i++){
  const a=v1[i],b=v2[i];assert.equal(a.id,b.id);
  assert.equal(a.spacing,b.spacing);assert.equal(a.weight,b.weight);
  assert.equal(a.technique,b.technique);assert.equal(a.italic,b.italic);
  assert.equal(Object.keys(b.glyphs).length,26);
  for(const [ch,g]of Object.entries(b.glyphs)){
   assert.ok(g.shapes.length>0);
   if(!PILOT_EVIDENCE[b.id+':'+ch])assert.deepEqual(g,a.glyphs[ch],
    'Unapproved change to '+b.id+':'+ch);
   else assert.notDeepEqual(g,a.glyphs[ch]);
  }
 }
});
test('All words remain deterministically positioned, no silent V1 geometry change',()=>{
 const words=['MUSHROOM','PHI','φ','PROPORTION PIECE','SKUF'];
 for(const f of v2)for(const word of words){
  const a=composeV1(f.id,word,{seed:'fixed',variation:.04});
  const b=composeV2(f.id,word,{seed:'fixed',variation:.04});
  assert.deepEqual([b.word,b.width,b.height],[a.word,a.width,a.height]);
  assert.deepEqual(b.letters.map(l=>[l.ch,l.x,l.y,l.rotation,l.scale]),
   a.letters.map(l=>[l.ch,l.x,l.y,l.rotation,l.scale]));
  assert.deepEqual(b,composeV2(f.id,word,{seed:'fixed',variation:.04}));
 }
});
test('All V2 geometry and symbol paths remain valid; improvements are named hypotheses',()=>{
 assert.match(V2_REVISION,/pilot-sheets20-29-59-10/);
 for(const f of v2)for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZΦ'){
  const glyph=getGlyph(f.id,ch);assert.ok(glyph.shapes.length);
  for(const s of glyph.shapes)assert.match(s.d,/^M\s*-?[\d.]+\s+-?[\d.]+/);
 }
 for(const e of Object.values(PILOT_EVIDENCE)){
  assert.ok([20,29,59,10].includes(e.sheet));
  assert.ok(e.observation.length>75&&e.change.length>50);
 }
});
