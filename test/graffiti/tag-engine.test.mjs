import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createTag,planFloorTags,HANDS,REFERENCE_STUDIES,normaliseText,drawTag,PHI,goldenMetrics,letterSkeleton,tagDuration,strokeFraction} from './tag-engine.mjs';
import {buildSprayPlan} from './spray-paint.mjs';
import {planWritingMotion,connectionClear} from './writing-motion.mjs';

test('joins meet their actual neighbours, with no connection across a word break',()=>{
 let joins=0;
 for(const hand of Object.keys(HANDS))for(const seed of ['first','second']){
  const tag=createTag('ECHO MARK',{hand,seed});
  for(let i=0;i<tag.strokes.length;i++)if(tag.strokes[i].kind==='join'){
   const join=tag.strokes[i];joins++;
   assert.deepEqual(join.points[0],tag.strokes[i-1].points.at(-1),hand+' join start');
   assert.deepEqual(join.points.at(-1),tag.strokes[i+1].points[0],hand+' join end');
  }
  for(const connection of tag.flow.connections)assert.ok(!tag.text.slice(connection.from+1,connection.to).includes(' '));
  if(REFERENCE_STUDIES[hand]?.shape==='oneline')assert.equal(tag.strokes.filter(s=>s.kind==='letter').length,2);
  if(tag.strokes[0].kind==='entry')assert.deepEqual(tag.strokes[0].points.at(-1),tag.strokes[1].points[0]);
 }
 assert.ok(joins>30);
 assert.equal(connectionClear([{x:0,y:0},{x:50,y:0}],[{points:[{x:25,y:-10},{x:25,y:10}]}]),false);
 assert.equal(connectionClear([{x:0,y:0},{x:50,y:0}],[{points:[{x:0,y:-10},{x:0,y:10}]}]),true);
});
test('writer habits persist across words and seeds while execution changes',()=>{
 for(const hand of Object.keys(HANDS)){
  const a=createTag('ALPHA',{hand,seed:'hit-a'}),b=createTag('ALPHA',{hand,seed:'hit-b'}),c=createTag('MARK',{hand,seed:'other-word'});
  assert.deepEqual(a.writer,b.writer);assert.deepEqual(a.writer,c.writer);assert.notDeepEqual(a.strokes,b.strokes);
  for(const frame of [...a.construction.letters,...b.construction.letters,...c.construction.letters])assert.equal(frame.variant,a.writer.variants[frame.character]);
  for(const stroke of a.strokes)assert.ok(Math.abs(stroke.nib-a.writer.nib)<=.0121);
 }
});
test('turns slow the hand, lift travel pauses it, and shared playback follows the timing',()=>{
 const points=[...Array.from({length:101},(_,x)=>({x,y:0})),...Array.from({length:100},(_,i)=>({x:100,y:i+1}))];
 const strokes=[{points,kind:'letter'},{points:[{x:120,y:100},{x:150,y:100}],kind:'letter'}];
 const motion=planWritingMotion(strokes),tag={strokes,motion};
 assert.ok(motion.strokes[0].speeds[100]<motion.strokes[0].speeds[50]-.2);
 assert.ok(motion.strokes[1].pause>.035);
 const inPause=(motion.strokes[0].start+motion.strokes[0].duration+motion.strokes[1].pause/2)/motion.duration;
 assert.equal(strokeFraction(tag,0,inPause),1);assert.equal(strokeFraction(tag,1,inPause),0);
 assert.equal(strokeFraction(tag,1,1),1);
 const sprayTag={...tag,seed:'speed',ink:'#222222',weight:7,opacity:.9,sprayFlare:1,strokes:strokes.map(s=>({...s,weight:1,pressure:1,phase:0}))};
 const plan=buildSprayPlan(sprayTag),fast=plan.dabs.filter(d=>d.x>20&&d.x<70&&d.y<1),slow=plan.dabs.filter(d=>d.x>96&&d.y<5);
 const mean=xs=>xs.reduce((n,d)=>n+d.opacity,0)/xs.length;
 assert.ok(fast.length&&slow.length);assert.ok(mean(slow)>mean(fast)*1.08);
 assert.equal(plan.total,motion.duration);
});

test('aerosol deposits are seeded, stay in bounds and leave the phi geometry unchanged',()=>{
 const tag=createTag('ECHO',{seed:'aerosol'}),copy=structuredClone(tag),a=buildSprayPlan(tag),b=buildSprayPlan(copy);
 assert.deepEqual(a,b);assert.deepEqual(tag,copy);assert.ok(a.dabs.length>300);
 let previous=-1;
 for(const dab of a.dabs){assert.ok(dab.at>=previous);previous=dab.at;assert.ok(dab.opacity>0&&dab.opacity<=1);assert.ok(dab.radius>0);const r=dab.radius*a.halo;assert.ok(dab.x-r>tag.bounds.x&&dab.x+r<tag.bounds.x+tag.bounds.width);assert.ok(dab.y-r>tag.bounds.y&&dab.y+r<tag.bounds.y+tag.bounds.height);}
 assert.equal(a.total,tagDuration(tag));
 assert.notDeepEqual(a.dabs,buildSprayPlan(createTag('ECHO',{seed:'different'})).dabs);
});

test('all fifty reference studies have distinct recipes and valid spray footprints',()=>{
 assert.equal(Object.keys(REFERENCE_STUDIES).length,50);assert.equal(Object.keys(HANDS).length,53);
 const recipes=new Set(),signatures=new Set();
 for(const [id,study] of Object.entries(REFERENCE_STUDIES)){
  recipes.add(JSON.stringify([study.shape,study.lean,study.width,study.height,study.weight,study.spacing,study.join,study.bounce,study.gesture,study.flare]));
  const tag=createTag('ECHO',{hand:id,seed:'all-studies'}),spray=buildSprayPlan(tag);signatures.add(JSON.stringify(tag.strokes));
  assert.equal(tag.construction.metrics.ratio,PHI);assert.ok(spray.dabs.length>100);
  for(const dab of spray.dabs){const r=dab.radius*spray.halo;assert.ok(dab.x-r>tag.bounds.x&&dab.x+r<tag.bounds.x+tag.bounds.width,id);assert.ok(dab.y-r>tag.bounds.y&&dab.y+r<tag.bounds.y+tag.bounds.height,id);}
  if(study.shape==='oneline')assert.equal(tag.strokes.filter(s=>s.kind==='letter').length,1);
 }
 assert.equal(recipes.size,50);assert.equal(signatures.size,50);
});

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
 drawTag(ctx,tag,{marker,finish:'marker'});assert.ok(deposits>=tag.strokes.length*2);assert.deepEqual(tag,copy);assert.equal(marker.stroke,original);assert.equal(marker.svgRecorder,undefined);
 const full=deposits;deposits=0;drawTag(ctx,tag,{marker,progress:0,finish:'marker'});assert.equal(deposits,0);
 drawTag(ctx,tag,{marker,progress:.4,finish:'marker'});assert.ok(deposits>0&&deposits<full);
});
