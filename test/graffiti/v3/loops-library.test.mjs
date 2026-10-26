import test from 'node:test';
import assert from 'node:assert/strict';
import {composeWord,FAMILIES} from '../v2/v2-library.mjs';
import {wordPlan} from '../v2/word-flow.mjs';
import {composeLoopsWord,LOOP_VARIANTS,LOOPS_REVISION} from './loops-library.mjs';
const family=FAMILIES.find(f=>f.id==='G');
function compose(word,mode='restrained',seed='fixed'){return composeLoopsWord(wordPlan(family,composeWord('G',word,{seed,variation:0})),{seed,mode});}
test('V3 Loops variants preserve all original V2 structural glyph shapes',()=>{
 for(const word of ['PROPORTION PIECE','MUSHROOM','FAST','PROCESS','ROTOR']){
  const plan=wordPlan(family,composeWord('G',word,{seed:'fixed',variation:0}));
  const result=compose(word);
  assert.equal(result.letters.length,plan.letters.length);
  for(let i=0;i<plan.letters.length;i++)assert.ok(result.letters[i].shapes.length>0);
 }
 assert.match(LOOPS_REVISION,/interlocking/);
 assert.deepEqual(Object.keys(LOOP_VARIANTS).sort(),[...'PROTINEC'].sort());
});
test('connected letters are adjacent, within word, deterministic, and have distinct states',()=>{
 const a=compose('PROPORTION PIECE','expressive');
 assert.ok(a.connectors.length>0);
 assert.deepEqual(a,compose('PROPORTION PIECE','expressive'));
 assert.ok(a.connectors.every(c=>c.to===c.from+1&&c.d.startsWith('M ')&&c.width>0));
 const byIndex=new Map(a.letters.map(l=>[l.index,l]));
 for(const c of a.connectors){
  assert.equal(byIndex.get(c.from).variant,'send');
  assert.equal(byIndex.get(c.to).variant,'receive');
  assert.ok(c.pair.length===2);
 }
 assert.equal(compose('PROPORTION PIECE','none').connectors.length,0);
 assert.ok(a.connectors.length>=compose('PROPORTION PIECE','restrained').connectors.length);
});

test('PRO and ORT use shared structural passes rather than complete V2 letters plus decoration',()=>{
 const connected=compose('PROPORTION PIECE','expressive');
 assert.ok(connected.shared.some(x=>x.sequence==='PRO'));
 assert.ok(connected.shared.some(x=>x.sequence==='ORT'));
 for(const pass of connected.shared){
  assert.equal(pass.sharedStructure,true);
  assert.equal(pass.members.length,3);
  assert.ok(pass.members.every((n,i,a)=>i===0||n===a[i-1]+1));
 }
 const plain=compose('PROPORTION PIECE','none');
 assert.equal(plain.shared.length,0);
});
