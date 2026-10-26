import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTowerFamilyTag,TOWER_LETTERING_REVISION} from '../gallery/visit/tower-family-lettering.mjs';
test('Broad-nib tower tags use V3 shared construction indoors and outside',()=>{
 for(const text of ['PROPORTION PIECE','PIECE','PHI']){
  const tag=makeTowerFamilyTag(text,{hand:'F',seed:'tower-regression'});
  assert.equal(tag.renderer,'az-nine-v1');
  assert.equal(tag.version,TOWER_LETTERING_REVISION);
  assert.ok(Array.isArray(tag.plan.shared));
  assert.ok(tag.plan.letters.every(l=>Array.isArray(l.shapes)));
  for(const l of tag.plan.letters)for(const shape of l.shapes)
   assert.ok(['structure','ornament'].includes(shape.role),'invalid semantic role '+shape.role);
  if(text==='PIECE'){
   const e=tag.plan.letters.find((l,i)=>l.ch==='E'&&tag.plan.letters[i-1]?.ch==='I');
   assert.ok(e?.shapes.some(s=>s.feature==='E-middle-arm'));
  }
 }
});
test('all other families retain original V2 construction',()=>{
 for(const hand of 'ABCDEGHI'){
  const tag=makeTowerFamilyTag('PROPORTION PIECE',{hand,seed:'tower-regression'});
  assert.equal(tag.plan.shared.length,0);
  assert.ok(tag.plan.letters.every(l=>!('shapes' in l)));
 }
});
