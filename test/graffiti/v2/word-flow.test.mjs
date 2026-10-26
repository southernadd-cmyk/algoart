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
test('Gothic A has a substantive crossbar and ornaments cannot suppress structural crossbars',()=>{
 const a=getGlyph('E','A');
 assert.ok(a.shapes.some(s=>s.kind==='fill'&&s.d.includes('L 72 57')));
 const f=FAMILIES.find(f=>f.id==='E');
 const plan=wordPlan(f,composeWord('E','FAST',{variation:0}));
 assert.ok(plan.letters.find(x=>x.ch==='A'));
 for(const l of plan.letters)for(const s of l.glyph.shapes)
  if(s.role==='ornament')assert.equal(showGesture(f,l,s,plan),false);
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
  const accents=plan.letters.flatMap(item=>item.glyph.shapes.filter(x=>x.role==='ornament'&&showGesture(f,item,x,plan)));
  // One chosen glyph can include several separate small strokes; the number
  // of glyphs receiving accents, not SVG subpaths, is the actual word budget.
  const withAccent=plan.letters.filter(item=>item.glyph.shapes.some(x=>x.role==='ornament'&&showGesture(f,item,x,plan)));
  assert.ok(withAccent.length<=WORD_POLICIES[f.id].ornamentsPerWord);
  assert.deepEqual(wordPlan(f,composeWord(f.id,name,{variation:0})),plan);
 }
});

test('all V2 letters explicitly distinguish structural marks from optional ornament',()=>{
 for(const f of FAMILIES)for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZΦ'){
  const glyph=getGlyph(f.id,ch);
  assert.ok(glyph.shapes.length>0);
  for(const shape of glyph.shapes){
   assert.ok(['structure','ornament'].includes(shape.role),f.id+ch+' unclassified stroke');
   if(shape.kind!=='hairline')assert.equal(shape.role,'structure',f.id+ch+' deleted main mark');
  }
 }
});
test('structural thin strokes survive with ALL ornaments disabled in T, E, F, H',()=>{
 // Every shape marked structure survives even when the word's accent budget is zero.
 for(const f of FAMILIES)for(const ch of 'TEFH'){
  const g=getGlyph(f.id,ch);
  const p=wordPlan(f,composeWord(f.id,ch,{variation:0})),item=p.letters[0];
  for(const s of g.shapes)if(s.role==='structure')assert.equal(
   showGesture(f,item,s,p,{ornaments:false}),true,f.id+ch+' lost structural '+s.kind);
 }
 const f=FAMILIES.find(f=>f.id==='E'),g=getGlyph('E','A');
 assert.ok(g.shapes.some(s=>s.role==='structure'&&s.d.includes('L 72 57')));
 for(const s of g.shapes)if(s.role==='structure')
  assert.equal(showGesture(f,wordPlan(f,composeWord('E','FAST',{variation:0})).letters[1],s,
   wordPlan(f,composeWord('E','FAST',{variation:0})),{ornaments:false}),true);
});
test('Interlocked overlap is reduced, and Gothic word break visibly expands',()=>{
 const a=FAMILIES.find(f=>f.id==='A');
 const original=composeWord('A','MUSHROOM',{variation:0});
 const planned=wordPlan(a,original);
 assert.ok(planned.letters[2].x-original.letters[2].x>=26,'U/S/H still stacked in A');
 const gothic=FAMILIES.find(f=>f.id==='E');
 const before=composeWord('E','PROPORTION PIECE',{variation:0});
 const after=wordPlan(gothic,before);
 const boundary=after.letters.findIndex((l,i)=>i>0&&l.index>after.letters[i-1].index+1);
 assert.ok(boundary>0);
 assert.ok(after.letters[boundary].x-after.letters[boundary-1].x>
  before.letters[boundary].x-before.letters[boundary-1].x+10);
});

test('known thin letter anatomy is role=structure: broad-nib T/E/F/H and chisel E',()=>{
 const cases=[['F','T',0],['F','E',1],['F','F',1],['F','H',2]];
 for(const [family,letter,index] of cases){
  const g=getGlyph(family,letter),mark=g.shapes[index];
  assert.equal(mark.kind,'hairline',family+letter+' expected fine construction');
  assert.equal(mark.role,'structure',family+letter+' crossbar must not be treated as ornament');
  const f=FAMILIES.find(x=>x.id===family),plan=wordPlan(f,composeWord(f.id,letter,{variation:0}));
  assert.equal(showGesture(f,plan.letters[0],mark,plan,{ornaments:false}),true);
 }
 const chisel=getGlyph('I','E');
 assert.ok(chisel.shapes.filter(s=>s.role==='structure').length>=2);
});
test('Loops U has an open high entrance and S remains a distinct two-bowl spine',()=>{
 const u=getGlyph('G','U'),s=getGlyph('G','S');
 assert.ok(u.shapes.some(x=>x.d.startsWith('M 9 1 C 10 34')));
 assert.ok(s.shapes.some(x=>x.d.startsWith('M 82 15 C 54 -9')));
 assert.equal(u.shapes.filter(x=>x.role==='ornament').length,1);
 assert.equal(s.shapes.filter(x=>x.role==='ornament').length,1);
});
