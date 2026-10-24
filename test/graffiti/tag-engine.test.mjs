import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createTag,planFloorTags,HANDS,normaliseText,drawTag,PHI,goldenMetrics,letterSkeleton} from './tag-engine.mjs';

test('phi constructs actual alphabet geometry, including bowl splits and crossbar intersections',()=>{
 const m=goldenMetrics();assert.ok(Math.abs(m.height/m.width-PHI)<1e-12);
 assert.ok(Math.abs(m.short+m.long-m.height)<1e-12);assert.ok(Math.abs(m.long/m.short-PHI)<1e-12);
 const A=letterSkeleton('A'),bar=A.strokes[1].points;
 assert.equal(bar[0].y,m.long);assert.equal(bar[1].y,m.long);
 // The crossbar ends lie on the two constructed diagonals, not at decorative
 // guide positions unrelated to the actual A.
 assert.ok(Math.abs(bar[0].x-m.width/2*(1-bar[0].y/m.height))<1e-12);
 const H=letterSkeleton('H');assert.ok(H.strokes[2].points.every(p=>p.y===m.long));
 const B=letterSkeleton('B');assert.ok(Math.abs(B.strokes[1].points.at(-1).y-m.short)<1e-12);
 assert.ok(Math.abs(B.strokes[2].points.at(-1).y-m.height)<1e-12);
 const normal=createTag('ABHOP',{seed:'phi-construction'}),different=createTag('ABHOP',{seed:'phi-construction',ratio:1.45});
 assert.notDeepEqual(normal.strokes,different.strokes);assert.notEqual(normal.construction.wordAdvance,different.construction.wordAdvance);
 assert.equal(normal.construction.letters.length,5);assert.equal(normal.construction.metrics.ratio,PHI);
 assert.throws(()=>goldenMetrics(0),RangeError);assert.throws(()=>goldenMetrics(100,1),RangeError);
});

test('every floor receives one or two reproducible tags, including upper floors',()=>{
 const seen=new Set();
 for(let floor=0;floor<300;floor++){
  const options={floorId:'exhibition-'+floor,seed:'tower'};
  const tags=planFloorTags(options);assert.ok(tags.length===1||tags.length===2);seen.add(tags.length);
  assert.deepEqual(tags,planFloorTags(options));
  for(const tag of tags){assert.equal(tag.floorId,options.floorId);assert.ok(HANDS[tag.hand]);}
 }
 assert.deepEqual([...seen].sort(),[1,2]);
});
test('new floors do not change the plans of existing exhibitions',()=>{
 const dates=['2026-10-21','2026-10-22','2026-10-23'];
 const before=dates.map(floorId=>planFloorTags({floorId}));
 const after=[...dates,'2026-10-24'].map(floorId=>planFloorTags({floorId}));
 assert.deepEqual(after.slice(0,3),before);assert.notDeepEqual(before[0],before[1]);
});
test('count validation prevents zero or more than two tags',()=>{
 for(const count of [0,3,-1,20,'all'])assert.throws(()=>planFloorTags({floorId:'a',count}),RangeError);
 assert.throws(()=>planFloorTags({}),TypeError);
 assert.equal(planFloorTags({floorId:'a',count:1}).length,1);assert.equal(planFloorTags({floorId:'a',count:2}).length,2);
});
test('whole words have deterministic finite geometry and bounds, including long words',()=>{
 for(const hand of Object.keys(HANDS))for(const word of ['PHI','ECHO','PROPORTION PIECE','ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0,24),'0123456789 φ.!?-']){
  const tag=createTag(word,{seed:'test',hand});assert.deepEqual(tag,createTag(word,{seed:'test',hand}));
  assert.ok(tag.strokes.some(s=>s.kind==='flourish'));assert.ok(tag.bounds.width>0&&tag.bounds.height>0);
  for(const s of tag.strokes)for(const p of s.points){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>tag.bounds.x&&p.y>tag.bounds.y);assert.ok(p.x<tag.bounds.x+tag.bounds.width&&p.y<tag.bounds.y+tag.bounds.height);}
 }
 assert.notDeepEqual(createTag('PHI',{seed:'a'}).strokes,createTag('PHI',{seed:'b'}).strokes);
 assert.notDeepEqual(createTag('PHI',{hand:'loop'}).strokes,createTag('PHI',{hand:'cut'}).strokes);
});
test('normalisation supports words and phi, and rejects markup safely',()=>{
 assert.equal(normaliseText('hello φ 42!'),'HELLO φ 42!');assert.equal(normaliseText('é😊'),'');
 assert.equal(normaliseText('A'.repeat(100)).length,24);assert.equal(createTag('').text,'PHI');
 assert.throws(()=>createTag('TEST',{hand:'missing'}),RangeError);
});
test('actual legacy marker renderer draws the planned strokes without a recorder or settings mutation',()=>{
 const env={window:{}};vm.createContext(env);
 for(const file of ['random.js','phi.js','marker.js'])vm.runInContext(fs.readFileSync(new URL('../../js/'+file,import.meta.url),'utf8'),env);
 const marker=env.window.AlgoArt,original=marker.stroke;let deposits=0;
 const ctx={save(){},restore(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},stroke(){deposits++;},fill(){deposits++;},setLineDash(){},globalCompositeOperation:'source-over'};
 const tag=createTag('ECHO',{seed:'marker-reuse'}),copy=structuredClone(tag);
 drawTag(ctx,tag,{marker});assert.ok(deposits>=tag.strokes.length*2);assert.deepEqual(tag,copy);assert.equal(marker.stroke,original);assert.equal(marker.svgRecorder,undefined);
 const full=deposits;deposits=0;drawTag(ctx,tag,{marker,progress:0});assert.equal(deposits,0);
 drawTag(ctx,tag,{marker,progress:.4});assert.ok(deposits>0&&deposits<full);
});
