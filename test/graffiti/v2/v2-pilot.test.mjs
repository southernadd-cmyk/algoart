import test from 'node:test';
import assert from 'node:assert/strict';
import {FAMILIES as v1,composeWord as composeV1} from '../family-library.mjs';
import {FAMILIES as v2,composeWord as composeV2,getGlyph,pilotDiff,PILOT_EVIDENCE,V2_REVISION} from './v2-library.mjs';

test('Source-led pilot documents twenty-seven revised glyphs in all nine families',()=>{
 assert.deepEqual(pilotDiff().sort(),['A:M','A:O','B:A','B:E','B:O','B:P','C:A','C:O','D:E','D:H','D:S','E:A','E:H','E:M','E:N','F:A','F:S','G:O','G:S','G:U','H:A','H:O','H:S','I:A','I:E','I:M','I:O']);
 assert.deepEqual(Object.keys(PILOT_EVIDENCE).sort(),pilotDiff().sort());
 assert.equal(v1.length,9);assert.equal(v2.length,9);
 for(let i=0;i<9;i++){
  const a=v1[i],b=v2[i];assert.equal(a.id,b.id);
  if(a.id==='B'){
   assert.equal(b.technique,'crosshand');assert.equal(b.weight,6.1);
   assert.notEqual(a.technique,b.technique);
  }else{
   assert.equal(a.spacing,b.spacing);assert.equal(a.weight,b.weight);
   assert.equal(a.technique,b.technique);assert.equal(a.italic,b.italic);
  }
  assert.equal(Object.keys(b.glyphs).length,26);
  for(const [ch,g]of Object.entries(b.glyphs)){
   assert.ok(g.shapes.length>0);
   if(!PILOT_EVIDENCE[b.id+':'+ch])assert.deepEqual(g.shapes.map(s=>[s.kind,s.d]),a.glyphs[ch].shapes.map(s=>[s.kind,s.d]),
    'Unapproved change to '+b.id+':'+ch);
   else assert.notDeepEqual(g.shapes.map(s=>[s.kind,s.d]),a.glyphs[ch].shapes.map(s=>[s.kind,s.d]));
  }
 }
});
test('All words remain deterministically positioned, no silent V1 geometry change',()=>{
 const words=['MUSHROOM','PHI','φ','PROPORTION PIECE','SKUF'];
 for(const f of v2)for(const word of words){
  const a=composeV1(f.id,word,{seed:'fixed',variation:.04});
  const b=composeV2(f.id,word,{seed:'fixed',variation:.04});
  if(f.id==='B'){
   assert.equal(b.word,a.word);
   assert.equal(b.height,a.height);
   assert.notEqual(b.width,a.width,'Source correction must change heavy marker tracking');
   assert.deepEqual(b.letters.map(l=>[l.ch,l.y,l.rotation,l.scale]),
    a.letters.map(l=>[l.ch,l.y,l.rotation,l.scale]));
  }else{
   assert.deepEqual([b.word,b.width,b.height],[a.word,a.width,a.height]);
   assert.deepEqual(b.letters.map(l=>[l.ch,l.x,l.y,l.rotation,l.scale]),
    a.letters.map(l=>[l.ch,l.x,l.y,l.rotation,l.scale]));
  }
  assert.deepEqual(b,composeV2(f.id,word,{seed:'fixed',variation:.04}));
 }
});
test('All V2 geometry and symbol paths remain valid; improvements are named hypotheses',()=>{
 assert.match(V2_REVISION,/source-led-glyph-repair/);
 for(const f of v2)for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZΦ'){
  const glyph=getGlyph(f.id,ch);assert.ok(glyph.shapes.length);
  for(const s of glyph.shapes)assert.match(s.d,/^M\s*-?[\d.]+\s+-?[\d.]+/);
 }
 for(const e of Object.values(PILOT_EVIDENCE)){
  assert.ok([7,8,10,13,20,29,30,41,59].includes(e.sheet));
  assert.ok(['source','legibility'].includes(e.basis));
  assert.ok(e.change.length>45);
  if(e.basis==='source')assert.ok(e.observation.length>75);
  else assert.ok(typeof e.failedWord==='string'&&e.failedWord.length>20&&/read as/.test(e.failedWord));
 }
});

test('legibility records name the failed word and cannot masquerade as source studies',()=>{
 const repairs=['B:E','B:P','H:O','I:E'];
 assert.deepEqual(Object.entries(PILOT_EVIDENCE).filter(([,e])=>e.basis==='legibility').map(([k])=>k).sort(),repairs);
 for(const key of repairs)assert.match(PILOT_EVIDENCE[key].failedWord,/read as/);
});
