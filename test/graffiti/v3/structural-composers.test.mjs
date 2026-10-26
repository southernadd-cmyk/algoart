import test from 'node:test';
import assert from 'node:assert/strict';
import {FAMILIES,composeWord} from '../v2/v2-library.mjs';
import {wordPlan} from '../v2/word-flow.mjs';
import {composeBroadNib} from './broadnib-library.mjs';
import {composeRectilinear} from './rectilinear-library.mjs';
function plan(family,word){const f=FAMILIES.find(x=>x.id===family);return wordPlan(f,composeWord(family,word,{seed:'fixed',variation:0}));}
for(const [name,family,compose] of [['nib','F',composeBroadNib],['rail','D',composeRectilinear]]){
 test(name+' constructions are deterministic, distinct, and space-safe',()=>{
  const p=plan(family,'PROPORTION PIECE');
  const expressive=compose(p,{seed:'fixed',mode:'expressive'});
  const baseline=compose(p,{seed:'fixed',mode:'none'});
  assert.deepEqual(expressive,compose(p,{seed:'fixed',mode:'expressive'}));
  assert.equal(baseline.shared.length,0);
  assert.ok(expressive.shared.length>0,'Expected at least one shared structure');
  assert.ok(expressive.shared.every(x=>x.structural&&x.to===x.from+1));
  const map=new Map(expressive.letters.map(l=>[l.index,l]));
  for(const stroke of expressive.shared){
   assert.equal(map.get(stroke.from).index+1,map.get(stroke.to).index);
   assert.match(stroke.d,/^M /);
   assert.ok(stroke.width>2);
  }
  assert.equal(expressive.letters.length,p.letters.length);
 });
}
test('nib strokes flow continuously while square-rail strokes have hard corner commands',()=>{
 const nib=composeBroadNib(plan('F','PROPORTION PIECE'),{seed:'fixed',mode:'expressive'}).shared;
 const rails=composeRectilinear(plan('D','PROPORTION PIECE'),{seed:'fixed',mode:'expressive'}).shared;
 assert.ok(nib.every(x=>x.d.includes(' C ')));
 assert.ok(rails.every(x=>x.d.includes(' L ')));
});
