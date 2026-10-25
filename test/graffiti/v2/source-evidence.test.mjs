import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const data=JSON.parse(fs.readFileSync(fileURLToPath(new URL('./source-evidence-ledger.json',import.meta.url)),'utf8'));
const refIndex=new Map(data.full_tag_sources.map(s=>[s.id,s]));
test('all nine V2 families have distinct uploaded sheets and a reviewable evidence trail',()=>{
 assert.deepEqual(data.families.map(f=>f.id),'ABCDEFGHI'.split(''));
 assert.equal(new Set(data.families.map(f=>f.primary_sheet)).size,9);
 for(const f of data.families){
  assert.ok(Number.isInteger(f.primary_sheet)&&f.primary_sheet>=1&&f.primary_sheet<=60);
  assert.ok(f.supporting_sheets.length>=2);
  assert.ok(Object.keys(f.observed_letters).length>=2,f.id+' lacks concrete observed glyphs');
  assert.ok(f.tag_comparators.length>=2);
  assert.ok(f.next_measure.length>=50);
  assert.ok(f.do_not.length>=30);
  for(const tag of f.tag_comparators){
   const source=refIndex.get(tag);assert.ok(source,'Unknown secondary reference '+tag);
   assert.match(source.url,/^https:\/\//);
   assert.notEqual(source.url,data.primary_source.url);
  }
 }
});
test('writer identity never inferred from uploaded image sheet order',()=>{
 assert.match(data.scope,/NOT verified artist identities/);
 assert.match(data.primary_source.usage,/local-only/);
 assert.match(data.families.find(x=>x.id==='B').evidence,/contradicts/);
 assert.match(data.families.find(x=>x.id==='B').do_not,/faithful transcription/);
});
test('evidence page can display all sources while keeping source images private',()=>{
 const html=fs.readFileSync(fileURLToPath(new URL('./evidence.html',import.meta.url)),'utf8');
 assert.match(html,/source-evidence-ledger\.json/);
 assert.match(html,/original 60 sheets are held/);
 assert.doesNotMatch(html,/<img\b/);
});
