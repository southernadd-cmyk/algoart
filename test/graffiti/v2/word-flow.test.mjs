import test from 'node:test';
import assert from 'node:assert/strict';
import {FAMILIES,composeWord,getGlyph} from './v2-library.mjs';
import {WORD_POLICIES,WORD_FLOW_REVISION,wordPlan,showGesture} from './word-flow.mjs';
test('nine complete, independently stated per-word policies',()=>{
 assert.deepEqual(Object.keys(WORD_POLICIES),'ABCDEFGHI'.split(''));
 for(const f of FAMILIES){
  const p=WORD_POLICIES[f.id];
  assert.ok(p.why.length>45);
  assert.ok(p.ornamentsPerWord>=0&&p.ornamentsPerWord<=2);
  assert.ok(p.maxJoins>=0&&p.maxJoins<=2);
 }
 assert.match(WORD_FLOW_REVISION,/source-led/);
});
test('Gothic A has a substantive crossbar and unsupported word hairlines are suppressed',()=>{
 const a=getGlyph('E','A');
 assert.ok(a.shapes.some(s=>s.kind==='fill'&&s.d.includes('L 72 57')));
 const f=FAMILIES.find(f=>f.id==='E');
 const plan=wordPlan(f,composeWord('E','FAST',{variation:0}));
 assert.ok(plan.letters.find(x=>x.ch==='A'));
 for(const l of plan.letters)for(const s of l.glyph.shapes)
  if(s.kind==='hairline')assert.equal(showGesture(f,l,s,plan),false);
 assert.equal(WORD_POLICIES.E.maxJoins,0);
});
test('Block SH is spaced to stop marker shelf collisions',()=>{
 const f=FAMILIES.find(x=>x.id==='D');
 const plain=composeWord('D','MUSHROOM',{variation:0});
 const adjusted=wordPlan(f,plain);
 const ix=adjusted.letters.findIndex((x,i)=>x.ch==='H'&&adjusted.letters[i-1]?.ch==='S');
 assert.ok(ix>0);
 const originalGap=plain.letters[ix].x-plain.letters[ix-1].x;
 const newGap=adjusted.letters[ix].x-adjusted.letters[ix-1].x;
 assert.ok(newGap-originalGap>=20);
});
test('decorative hairlines are bounded per word, independent of word length',()=>{
 for(const f of FAMILIES)for(const name of ['MUSHROOM','PHI','PROPORTION PIECE','SKUF']){
  const plan=wordPlan(f,composeWord(f.id,name,{variation:0}));
  assert.equal(plan.letters.length,plan.letters.filter(x=>x.ch!==' ').length);
  const accents=plan.letters.flatMap(item=>item.glyph.shapes.filter(x=>x.kind==='hairline'&&showGesture(f,item,x,plan)));
  // One chosen glyph can include several separate small strokes; the number
  // of glyphs receiving accents, not SVG subpaths, is the actual word budget.
  const withAccent=plan.letters.filter(item=>item.glyph.shapes.some(x=>x.kind==='hairline'&&showGesture(f,item,x,plan)));
  assert.ok(withAccent.length<=WORD_POLICIES[f.id].ornamentsPerWord);
  assert.deepEqual(wordPlan(f,composeWord(f.id,name,{variation:0})),plan);
 }
});
