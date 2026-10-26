import test from 'node:test';
import assert from 'node:assert/strict';
import {FAMILIES,composeWord} from '../v2/v2-library.mjs';
import {wordPlan} from '../v2/word-flow.mjs';
import {composeStyleWord,RULES} from './style-grammar.mjs';
test('all nine families compose deterministically without joining across spaces',()=>{
 for(const family of FAMILIES){
  const p=wordPlan(family,composeWord(family.id,'PROPORTION PIECE',{seed:'fixed',variation:0}));
  const a=composeStyleWord(family.id,p,{seed:'test',mode:'expressive'});
  assert.deepEqual(a,composeStyleWord(family.id,p,{seed:'test',mode:'expressive'}));
  for(const c of [...a.connectors,...a.shared]){
   if(c.from!==undefined)assert.equal(c.to,c.from+1);
  }
  assert.equal(a.letters.length,p.letters.length);
 }
 assert.equal(Object.keys(RULES).length,8);
});
test('Lo​ops retains existing shared-letter construction',()=>{
 const f=FAMILIES.find(x=>x.id==='G');
 const p=wordPlan(f,composeWord('G','PROPORTION PIECE',{seed:'fixed',variation:0}));
 assert.ok(composeStyleWord('G',p,{mode:'expressive'}).shared.some(x=>x.members?.length>=3));
});
