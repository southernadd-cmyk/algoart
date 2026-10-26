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
  assert.ok(expressive.shared.every(x=>x.structural&&(x.members?.length===3||x.to===x.from+1)));
  const map=new Map(expressive.letters.map(l=>[l.index,l]));
  for(const stroke of expressive.shared){
   if(stroke.from!==undefined)assert.equal(map.get(stroke.from).index+1,map.get(stroke.to).index);
   if(stroke.members)assert.ok(stroke.members.every((n,i,a)=>i===0||n===a[i-1]+1));
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

test('Broad-nib replaces recipient skeletons in three-letter shared clusters',()=>{
 const p=plan('F','PROPORTION PIECE');
 let found=false;
 for(const seed of ['fixed','alpha','beta','gamma']){
  const result=composeBroadNib(p,{seed,mode:'expressive'});
  for(const stroke of result.shared.filter(x=>x.members)){
   found=true;
   assert.equal(stroke.members.length,3);
   assert.ok(stroke.d.includes(' C '));
   for(const index of stroke.members.slice(1)){
    const original=p.letters.find(x=>x.index===index);
    const modified=result.letters.find(x=>x.index===index);
    assert.ok(modified.shapes.length>=original.glyph.shapes.length-1);
    assert.ok(modified.shapes.length<=original.glyph.shapes.length);
   }
  }
 }
 assert.ok(found);
});

test('Broad-nib E after I gets a structural middle arm, C does not',()=>{
 const p=plan('F','PIECE');
 const result=composeBroadNib(p,{seed:'fixed',mode:'restrained'});
 const e=result.letters.find((l,i)=>l.ch==='E'&&result.letters[i-1]?.ch==='I');
 assert.ok(e,'Expected E after I');
 assert.ok(e.shapes.some(st=>st.feature==='E-middle-arm'&&st.subtype==='crossbar'));
 assert.ok(result.shared.every(st=>st.feature!=='E-middle-arm'));
});
