import test from 'node:test';
import assert from 'node:assert/strict';
import {ALPHABETS,TOWER_HANDS,alphabetRevision,alphabetIdentity,pickTowerHand,resolveAlphabetIdentity} from '../gallery/visit/tower-graffiti-styles.mjs';
test('eight curated alphabets have independent pinned revisions',()=>{
 assert.equal(TOWER_HANDS.length,8);
 assert.equal(new Set(TOWER_HANDS).size,8);
 for(const id of TOWER_HANDS){
  assert.equal(ALPHABETS[id].id,id);
  assert.equal(alphabetRevision(id),1);
  assert.equal(alphabetIdentity(id),id+'@1');
 }
});
test('legacy tower hand selection remains stable',()=>{
 for(let i=0;i<TOWER_HANDS.length;i++)
  assert.equal(pickTowerHand({n:()=>i/TOWER_HANDS.length}),TOWER_HANDS[i]);
});
test('invalid alphabet and revisions are rejected',()=>{
 assert.throws(()=>alphabetRevision('missing'),RangeError);
 assert.throws(()=>alphabetIdentity('guess',0),RangeError);
});

test('recorded atlas revisions resolve only to available immutable grammars',()=>{
 for(const id of TOWER_HANDS)
  assert.equal(resolveAlphabetIdentity(alphabetIdentity(id)),ALPHABETS[id]);
 assert.throws(()=>resolveAlphabetIdentity('guess@2'),RangeError);
 assert.throws(()=>resolveAlphabetIdentity('unknown@1'),RangeError);
 assert.throws(()=>resolveAlphabetIdentity('guess@01'),RangeError);
});
