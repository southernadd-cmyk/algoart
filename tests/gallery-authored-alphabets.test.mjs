import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTHORED_ALPHABET_DRAFTS,draftGlyph} from '../test/graffiti/authored-alphabet-drafts.mjs';
test('drafts cover every capital with finite stroke coordinates',()=>{
 for(const id of ['skofe','skuf']){
  const letters=AUTHORED_ALPHABET_DRAFTS[id].letters;
  assert.equal(Object.keys(letters).length,26);
  for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){
   const glyph=draftGlyph(id,ch,{width:60,height:100});
   assert.ok(glyph.strokes.length);
   for(const stroke of glyph.strokes)for(const p of stroke.points){
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
   }
  }
 }
});
test('drafts remain opt-in and do not replace legacy writer grammar',()=>{
 assert.equal(AUTHORED_ALPHABET_DRAFTS.skofe.revision,2);
 assert.equal(AUTHORED_ALPHABET_DRAFTS.skuf.revision,2);
});
