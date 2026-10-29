import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupPhiExhibition,studyCurationTraits} from '../gallery/visit/phi-curation-groups.mjs';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';

test('traits use saved palette and recognise current paint versions',()=>{
 assert.deepEqual(studyCurationTraits({href:'?mode=field&pal=earth&material=oil-v5',material:{type:'oil'}}),
  {engine:'field',material:'oil',palette:'earth'});
 assert.equal(studyCurationTraits({href:'?material=action-v3',material:{type:'action'}}).material,'action');
 assert.deepEqual(studyCurationTraits({}),{engine:'',material:'',palette:''});
});
for(const dimension of ['engine','material','palette'])test(dimension+' alone can form mixed painting/sculpture groups',()=>{
 const studies=Array.from({length:8},(_,id)=>({id,portrait:id>=4,aspect:1.4,[dimension]:id%2?'a':'b'}));
 const paintings=studies.slice(0,4).map(s=>({studyId:s.id,room:Math.floor(s.id/2)}));
 const sculptures=studies.slice(4).map(s=>({studyId:s.id,room:Math.floor((s.id-4)/2)}));
 const report=groupPhiExhibition(paintings,sculptures,studies);
 assert.ok(report.score>report.baselineScore);
 assert.ok(report.rooms.every(r=>r.theme.dimension===dimension&&r.theme.count===4));
 assert.equal(new Set([...paintings,...sculptures].map(p=>p.studyId)).size,8);
});
test('missing or universal metadata leaves the safe arrangement unchanged',()=>{
 const paintings=[{studyId:0,room:0},{studyId:1,room:1}];
 const before=structuredClone(paintings);
 assert.equal(groupPhiExhibition(paintings,[],[{id:0,material:'marker'},{id:1,material:'marker'}]).swaps,0);
 assert.deepEqual(paintings,before);
});
test('different painting aspects cannot exchange frames',()=>{
 const studies=Array.from({length:4},(_,id)=>({id,aspect:id+1,engine:id%2?'a':'b'}));
 const paintings=studies.map(s=>({studyId:s.id,room:Math.floor(s.id/2)})),before=structuredClone(paintings);
 groupPhiExhibition(paintings,[],studies);assert.deepEqual(paintings,before);
});

const archive=JSON.parse(readFileSync(new URL('../gallery/tower-layouts.json',import.meta.url)));
const geometry=exhibition=>[...exhibition.paintings,...exhibition.sculptures].map(({studyId,...position})=>position);
for(const {date} of archive.floors)test('thematic curation preserves real archive '+date,()=>{
 const html=readFileSync(new URL('../gallery/'+date+'/index.html',import.meta.url),'utf8');
 const studies=[...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(([card],id)=>{
  const width=Number(card.match(/<img[^>]*width="(\d+)"/)?.[1]);
  const height=Number(card.match(/<img[^>]*height="(\d+)"/)?.[1]);
  const href=card.match(/class="remix" href="([^"]+)"/)?.[1].replaceAll('&amp;','&');
  return {id,portrait:/data-orientation="portrait"/.test(card)||height>width,aspect:width/height||1.4,
   href,material:card.match(/data-material="([^"]+)"/)?.[1]};
 });
 const baseline=buildPhiRendererPlan(date,studies.map(({id,portrait,aspect})=>({id,portrait,aspect})));
 const curated=buildPhiRendererPlan(date,studies);
 assert.deepEqual(curated.checks,{connected:true,count:true,unique:true,inwardFacing:true,clearances:true,unplaced:0});
 assert.deepEqual(geometry(curated.exhibition),geometry(baseline.exhibition),'All geometry must remain identical');
 assert.deepEqual(curated.exhibition,buildPhiRendererPlan(date,studies).exhibition);
 assert.ok(curated.exhibition.curation.score+1e-9>=curated.exhibition.curation.baselineScore);
 for(const p of curated.exhibition.paintings)assert.ok(Math.abs(p.width/p.height-studies[p.studyId].aspect)<1e-6);
 if(date==='2026-10-29'){
  assert.ok(curated.exhibition.curation.score>curated.exhibition.curation.baselineScore);
  console.log('Today’s room themes:',curated.exhibition.curation.rooms.map(r=>({room:r.room,theme:r.theme?.dimension,value:r.theme?.value,related:r.theme?.count,total:r.studyIds.length})));
 }
});
